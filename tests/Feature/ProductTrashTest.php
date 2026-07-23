<?php

namespace Tests\Feature;

use App\Models\PhotoScan;
use App\Models\Product;
use App\Models\ScanningSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Recoverable product deletion.
 *
 * Deleting a product moves it to Trash: the row survives with deleted_at set,
 * the product image and raw scan photos are left on disk, and an administrator
 * can restore it. Permanent deletion is separate, must be confirmed, and still
 * preserves raw scan photos.
 */
class ProductTrashTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        return $admin->fresh();
    }

    /** There is no ScanningSession factory; build one directly (user_id is required). */
    private function scanningSession(): ScanningSession
    {
        return ScanningSession::create([
            'user_id' => User::factory()->create()->id,
            'session_type' => 'regular_product',
        ]);
    }

    private ?int $categoryId = null;
    private ?int $unitId = null;

    /**
     * The shared TestCase helpers always create the same category/unit names,
     * which are unique columns, so reuse one of each. The factory leaves "code"
     * null and permanent deletion is confirmed by code, so set one explicitly.
     */
    private function product(array $attributes = []): Product
    {
        $this->categoryId ??= $this->createCategory()->id;
        $this->unitId ??= $this->createUnit()->id;

        return Product::factory()->create(array_merge([
            'category_id' => $this->categoryId,
            'unit_id' => $this->unitId,
            'product_type' => 'regular',
            'code' => 'TEST-'.strtoupper(Str::random(6)),
        ], $attributes));
    }

    // ------------------------------------------------------- delete -> trash

    public function test_deleting_a_product_moves_it_to_trash_instead_of_removing_it(): void
    {
        $product = $this->product();

        $this->actingAs($this->admin())->delete(route('products.destroy', $product));

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertNotNull(Product::withTrashed()->find($product->id));
    }

    public function test_deleting_a_lab_asset_moves_it_to_trash(): void
    {
        $labAsset = $this->product(['product_type' => 'lab_asset']);

        $this->actingAs($this->admin())->delete(route('lab-assets.destroy', $labAsset));

        $this->assertSoftDeleted('products', ['id' => $labAsset->id]);
    }

    public function test_trashing_a_product_does_not_delete_its_image(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('products/keep-me.jpg', 'image-bytes');

        $product = $this->product(['product_image' => 'keep-me.jpg']);

        $this->actingAs($this->admin())->delete(route('products.destroy', $product));

        Storage::disk('public')->assertExists('products/keep-me.jpg');
    }

    public function test_trashing_a_lab_asset_does_not_delete_its_image(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('lab-asset.jpg', 'image-bytes');

        $labAsset = $this->product([
            'product_type' => 'lab_asset',
            'product_image' => 'lab-asset.jpg',
        ]);

        $this->actingAs($this->admin())->delete(route('lab-assets.destroy', $labAsset));

        Storage::disk('public')->assertExists('lab-asset.jpg');
    }

    public function test_trashing_a_product_keeps_its_scan_relationships(): void
    {
        $product = $this->product();
        $session = $this->scanningSession();
        $scan = PhotoScan::create([
            'scanning_session_id' => $session->id,
            'product_id' => $product->id,
            'photo_path' => 'scans/'.$session->id.'/front.jpg',
            'photo_type' => 'overview',
        ]);

        $this->actingAs($this->admin())->delete(route('products.destroy', $product));

        $this->assertDatabaseHas('photo_scans', [
            'id' => $scan->id,
            'product_id' => $product->id,
        ]);
    }

    // ----------------------------------------------- lists and the public API

    public function test_trashed_products_are_hidden_from_listings_and_the_public_api(): void
    {
        $visible = $this->product(['name' => 'Still Listed']);
        $trashed = $this->product(['name' => 'In The Trash']);
        $trashed->delete();

        $this->assertSame(1, Product::count());
        $this->assertNull(Product::find($trashed->id));

        $response = $this->get('api/products');
        $response->assertOk();
        $response->assertSee('Still Listed');
        $response->assertDontSee('In The Trash');

        $ids = array_column($response->json(), 'id');
        $this->assertContains($visible->id, $ids);
        $this->assertNotContains($trashed->id, $ids);
    }

    // -------------------------------------------------------- trash + restore

    public function test_admin_sees_trashed_products_on_the_trash_page(): void
    {
        $product = $this->product(['name' => 'Trashed Item']);
        $product->delete();

        $response = $this->actingAs($this->admin())->get(route('products.trash.index'));

        $response->assertOk();
        $response->assertSee('Trashed Item');
        $response->assertSee($product->code);
    }

    public function test_admin_can_restore_a_trashed_product(): void
    {
        $product = $this->product();
        $product->delete();

        $this->actingAs($this->admin())
            ->put(route('products.trash.restore', $product->id))
            ->assertRedirect(route('products.trash.index'));

        $this->assertNotSoftDeleted('products', ['id' => $product->id]);
        $this->assertNotNull(Product::find($product->id));
    }

    public function test_a_restored_product_reappears_in_the_public_api(): void
    {
        $product = $this->product(['name' => 'Comes Back']);
        $product->delete();

        $this->get('api/products')->assertDontSee('Comes Back');

        $this->actingAs($this->admin())->put(route('products.trash.restore', $product->id));

        $this->get('api/products')->assertSee('Comes Back');
    }

    // --------------------------------------------------- permanent deletion

    public function test_permanent_deletion_requires_the_exact_product_code(): void
    {
        $product = $this->product();
        $product->delete();

        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => 'not-the-code']
        );

        // Still in the trash, not gone.
        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertNotNull(Product::withTrashed()->find($product->id));
    }

    public function test_permanent_deletion_requires_a_confirmation_value_at_all(): void
    {
        $product = $this->product();
        $product->delete();

        $this->actingAs($this->admin())
            ->delete(route('products.trash.forceDelete', $product->id), [])
            ->assertSessionHasErrors('confirmation');

        $this->assertNotNull(Product::withTrashed()->find($product->id));
    }

    public function test_permanent_deletion_with_the_correct_code_removes_the_product(): void
    {
        $product = $this->product();
        $product->delete();

        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => $product->code]
        );

        $this->assertNull(Product::withTrashed()->find($product->id));
    }

    public function test_permanent_deletion_preserves_raw_scan_photos(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('scans/1/front.jpg', 'raw-scan-bytes');

        $product = $this->product();
        $session = $this->scanningSession();
        $scan = PhotoScan::create([
            'scanning_session_id' => $session->id,
            'product_id' => $product->id,
            'photo_path' => 'scans/1/front.jpg',
            'photo_type' => 'overview',
        ]);
        $product->delete();

        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => $product->code]
        );

        // The scan row survives (product_id is nulled by the foreign key) and
        // the raw file on disk is never touched.
        $this->assertDatabaseHas('photo_scans', ['id' => $scan->id]);
        Storage::disk('public')->assertExists('scans/1/front.jpg');
    }

    // -------------------------------- permanent deletion with no product code

    public function test_a_product_without_a_code_falls_back_to_a_stable_phrase(): void
    {
        $product = $this->product(['code' => null]);

        $this->assertSame('DELETE-'.$product->id, $product->deletionConfirmationPhrase());
    }

    public function test_the_trash_page_shows_the_fallback_phrase_for_a_null_code_product(): void
    {
        $product = $this->product(['code' => null]);
        $product->delete();

        $response = $this->actingAs($this->admin())->get(route('products.trash.index'));

        $response->assertOk();
        $response->assertSee('DELETE-'.$product->id);
    }

    public function test_null_code_product_rejects_a_wrong_phrase_and_keeps_files_and_scans(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('products/nullcode.jpg', 'image-bytes');
        Storage::disk('public')->put('scans/9/front.jpg', 'raw-scan-bytes');

        $product = $this->product(['code' => null, 'product_image' => 'nullcode.jpg']);
        $session = $this->scanningSession();
        $scan = PhotoScan::create([
            'scanning_session_id' => $session->id,
            'product_id' => $product->id,
            'photo_path' => 'scans/9/front.jpg',
            'photo_type' => 'overview',
        ]);
        $product->delete();

        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => 'DELETE-wrong']
        );

        // Still trashed, nothing removed.
        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertNotNull(Product::withTrashed()->find($product->id));
        $this->assertDatabaseHas('photo_scans', ['id' => $scan->id, 'product_id' => $product->id]);
        Storage::disk('public')->assertExists('products/nullcode.jpg');
        Storage::disk('public')->assertExists('scans/9/front.jpg');
    }

    public function test_null_code_product_can_be_permanently_deleted_with_the_fallback_phrase(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('products/nullcode.jpg', 'image-bytes');
        Storage::disk('public')->put('scans/9/front.jpg', 'raw-scan-bytes');

        $product = $this->product(['code' => null, 'product_image' => 'nullcode.jpg']);
        $session = $this->scanningSession();
        $scan = PhotoScan::create([
            'scanning_session_id' => $session->id,
            'product_id' => $product->id,
            'photo_path' => 'scans/9/front.jpg',
            'photo_type' => 'overview',
        ]);
        $product->delete();

        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => 'DELETE-'.$product->id]
        );

        // The product is gone, but no file and no scan row was removed.
        $this->assertNull(Product::withTrashed()->find($product->id));
        $this->assertDatabaseHas('photo_scans', ['id' => $scan->id]);
        Storage::disk('public')->assertExists('products/nullcode.jpg');
        Storage::disk('public')->assertExists('scans/9/front.jpg');
    }

    // ------------------------------------------------------------ permissions

    public function test_non_admins_cannot_use_the_trash(): void
    {
        $regular = User::factory()->create();
        $product = $this->product();
        $product->delete();

        $this->actingAs($regular)->get(route('products.trash.index'))->assertForbidden();
        $this->actingAs($regular)->put(route('products.trash.restore', $product->id))->assertForbidden();
        $this->actingAs($regular)->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => $product->code]
        )->assertForbidden();

        // Nothing changed.
        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertNotNull(Product::withTrashed()->find($product->id));
    }

    public function test_guests_are_redirected_from_the_trash(): void
    {
        $this->get(route('products.trash.index'))->assertRedirect('/login');
    }

    public function test_non_admins_do_not_see_the_trash_navigation_link(): void
    {
        $response = $this->actingAs(User::factory()->create())->get('/clothing');

        $response->assertOk();
        $response->assertDontSee(route('products.trash.index'));
    }

    public function test_admins_see_the_trash_navigation_link(): void
    {
        $response = $this->actingAs($this->admin())->get('/clothing');

        $response->assertOk();
        $response->assertSee(route('products.trash.index'));
    }

    // ------------------------------------------------------------------ CSRF

    /**
     * VerifyCsrfToken short-circuits while running unit tests, so a 419 cannot
     * be asserted; assert instead that the trash actions ship CSRF tokens and
     * are not reachable by GET.
     */
    public function test_trash_actions_are_csrf_protected_and_not_get_reachable(): void
    {
        $product = $this->product();
        $product->delete();

        $page = $this->actingAs($this->admin())->get(route('products.trash.index'));
        $page->assertSee('name="_token"', false);
        $page->assertSee('name="_method" value="PUT"', false);
        $page->assertSee('name="_method" value="DELETE"', false);

        $this->actingAs($this->admin())
            ->get('/products/trash/'.$product->id.'/restore')
            ->assertStatus(405);
    }
}

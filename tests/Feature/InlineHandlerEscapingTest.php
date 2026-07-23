<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Product codes and asset names can arrive through spreadsheet imports, so they
 * must never reach a JavaScript execution context.
 *
 * Blade's {{ }} escapes quotes to entities, but the HTML parser decodes those
 * entities in an attribute value *before* the JavaScript is evaluated, so
 * interpolating such a value inside an inline on* handler lets a crafted code
 * break out of the string literal. These views now pass values as data
 * attributes that are read back with dataset, which is always a plain string.
 */
class InlineHandlerEscapingTest extends TestCase
{
    use RefreshDatabase;

    /** A payload that escapes a single-quoted JS string literal and calls a function. */
    private const PAYLOAD = "X'); alert('xss'); //";

    private ?int $categoryId = null;
    private ?int $unitId = null;

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        return $admin->fresh();
    }

    private function product(array $attributes = []): Product
    {
        $this->categoryId ??= $this->createCategory()->id;
        $this->unitId ??= $this->createUnit()->id;

        return Product::factory()->create(array_merge([
            'category_id' => $this->categoryId,
            'unit_id' => $this->unitId,
            'product_type' => 'regular',
        ], $attributes));
    }

    // ------------------------------------------------------------ trash page

    public function test_a_malicious_product_code_never_reaches_an_inline_handler(): void
    {
        $product = $this->product(['code' => self::PAYLOAD]);
        $product->delete();

        $response = $this->actingAs($this->admin())->get(route('products.trash.index'));

        $response->assertOk();

        // No inline submit handler exists at all on this page any more.
        $response->assertDontSee('onsubmit=', false);

        // The raw payload, with real quotes, must not appear anywhere in the
        // markup. Blade renders it as entities instead.
        $response->assertDontSee(self::PAYLOAD, false);
        $response->assertDontSee("alert('xss')", false);
    }

    public function test_the_malicious_code_is_still_displayed_escaped_to_the_administrator(): void
    {
        $product = $this->product(['code' => self::PAYLOAD]);
        $product->delete();

        $response = $this->actingAs($this->admin())->get(route('products.trash.index'));

        // assertSee escapes by default, so this asserts the safely-escaped form
        // is rendered: the administrator can still read the exact phrase.
        $response->assertSee(self::PAYLOAD);
        $response->assertSee('data-delete-label', false);
    }

    public function test_the_malicious_code_still_works_as_the_confirmation_phrase(): void
    {
        $product = $this->product(['code' => self::PAYLOAD]);
        $product->delete();

        // Behaviour is preserved: the phrase still gates permanent deletion.
        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => 'wrong']
        );
        $this->assertNotNull(Product::withTrashed()->find($product->id));

        $this->actingAs($this->admin())->delete(
            route('products.trash.forceDelete', $product->id),
            ['confirmation' => self::PAYLOAD]
        );
        $this->assertNull(Product::withTrashed()->find($product->id));
    }

    // ------------------------------------------------------- lab assets page

    public function test_a_malicious_asset_name_never_reaches_an_inline_handler(): void
    {
        $this->product([
            'product_type' => 'lab_asset',
            'name' => self::PAYLOAD,
        ]);

        $response = $this->actingAs($this->admin())->get('/lab-assets');

        $response->assertOk();

        // The old inline call site is gone entirely.
        $response->assertDontSee('onclick="deleteAsset(', false);
        $response->assertDontSee('onclick="changeStatus(', false);

        // The raw payload must not appear unescaped.
        $response->assertDontSee(self::PAYLOAD, false);
        $response->assertDontSee("alert('xss')", false);
    }

    public function test_the_malicious_asset_name_is_still_displayed_escaped(): void
    {
        $this->product([
            'product_type' => 'lab_asset',
            'name' => self::PAYLOAD,
        ]);

        $response = $this->actingAs($this->admin())->get('/lab-assets');

        $response->assertSee(self::PAYLOAD);
        $response->assertSee('data-delete-asset', false);
    }
}

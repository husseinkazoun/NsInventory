<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\ScanningSession;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClothingInventoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_clothing_inventory_and_scan_pages_render(): void
    {
        $user = User::factory()->create();
        Category::create(['name' => 'Jackets', 'slug' => 'jackets']);
        Unit::create(['name' => 'Piece', 'slug' => 'piece', 'short_code' => 'pc']);

        $this->actingAs($user)
            ->get(route('clothing.index'))
            ->assertOk()
            ->assertSee('Clothing Inventory');

        $this->actingAs($user)
            ->get(route('clothing.scan'))
            ->assertOk()
            ->assertSee('Scan a garment')
            ->assertSee('name="csrf-token"', false)
            ->assertSee('Detail or flaw (optional)')
            ->assertSee('Skip this optional photo')
            ->assertSee('Choose from phone photos or files')
            ->assertDontSee('capture="environment"', false)
            ->assertSee('postJsonWithXhr')
            ->assertSee('Review before saving');
    }

    public function test_confirmed_clothing_scan_creates_a_shop_item(): void
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'Jackets', 'slug' => 'jackets']);
        $unit = Unit::create(['name' => 'Piece', 'slug' => 'piece', 'short_code' => 'pc']);
        $session = ScanningSession::create([
            'session_type' => 'regular_product',
            'status' => 'in_progress',
            'user_id' => $user->id,
            'device_info' => ['inventory_mode' => 'clothing', 'workflow_version' => 1],
            'started_at' => now(),
        ]);

        $response = $this->actingAs($user)->postJson(
            route('api.scanning.complete', $session),
            [
                'create_products' => true,
                'product_data' => [
                    'inventory_mode' => 'clothing',
                    'name' => "Levi's blue denim jacket",
                    'category_id' => $category->id,
                    'unit_id' => $unit->id,
                    'garment_type' => 'Denim jacket',
                    'department' => 'unisex',
                    'brand' => "Levi's",
                    'size_label' => 'M',
                    'color' => 'Blue',
                    'material' => '100% cotton',
                    'condition_status' => 'good',
                    'condition_notes' => 'Light wear at cuffs',
                    'visible_flaws' => ['Light cuff wear'],
                    'storage_location' => 'Box A1',
                    'inventory_status' => 'ready',
                    'measurements' => ['chest_width' => 52.5, 'length' => 64],
                    'buying_price' => 5,
                    'selling_price' => 25,
                ],
            ]
        );

        $response->assertOk()->assertJsonPath('success', true);

        $product = Product::where('code', 'SH-0001')->firstOrFail();
        $this->assertSame('regular', $product->product_type);
        $this->assertSame('clothing', $product->specifications['inventory_mode']);
        $this->assertSame('M', $product->specifications['size_label']);
        $this->assertSame('Box A1', $product->specifications['storage_location']);
        $this->assertEquals(25.0, $product->selling_price);
    }
}

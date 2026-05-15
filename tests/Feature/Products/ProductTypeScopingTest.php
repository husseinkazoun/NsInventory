<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductTypeScopingTest extends TestCase
{
    use RefreshDatabase;

    private function seedOneRegularAndOneLabAsset(): array
    {
        $category = Category::factory()->create();
        $unit     = Unit::factory()->create();

        // Pin tax_type to a valid enum case (0 = Exclusive); the upstream
        // ProductFactory picks randomElement([1, 2]) but TaxType only has 0/1.
        $regular = Product::factory()->create([
            'name'             => 'Regular Widget',
            'slug'             => 'regular-widget',
            'code'             => 'REG-001',
            'product_type'     => 'regular',
            'tax_type'         => 0,
            'category_id'      => $category->id,
            'unit_id'          => $unit->id,
            'asset_status'     => 'active',
            'condition_status' => 'good',
        ]);

        $labAsset = Product::factory()->create([
            'name'             => 'Lab Computer X',
            'slug'             => 'lab-computer-x',
            'code'             => 'LA-001',
            'product_type'     => 'lab_asset',
            'tax_type'         => 0,
            'category_id'      => $category->id,
            'unit_id'          => $unit->id,
            'asset_status'     => 'active',
            'condition_status' => 'good',
        ]);

        return compact('regular', 'labAsset', 'category', 'unit');
    }

    public function test_regular_product_index_excludes_lab_assets(): void
    {
        $user = User::factory()->create();
        $this->seedOneRegularAndOneLabAsset();

        $regularNames = Product::regularProducts()->pluck('name')->all();
        $this->assertContains('Regular Widget', $regularNames);
        $this->assertNotContains('Lab Computer X', $regularNames);

        // Route renders without crashing and binds the Livewire product table.
        $this->actingAs($user)->get('/products')->assertOk();
    }

    public function test_lab_asset_index_excludes_regular_products(): void
    {
        $user = User::factory()->create();
        $this->seedOneRegularAndOneLabAsset();

        $labNames = Product::labAssets()->pluck('name')->all();
        $this->assertContains('Lab Computer X', $labNames);
        $this->assertNotContains('Regular Widget', $labNames);

        // The /lab-assets index page renders the lab-asset table directly in Blade.
        $response = $this->actingAs($user)->get('/lab-assets');
        $response->assertOk();
        $response->assertSee('Lab Computer X');
        $response->assertDontSee('Regular Widget');
    }

    public function test_dashboard_product_count_excludes_lab_assets(): void
    {
        $user = User::factory()->create();
        $this->seedOneRegularAndOneLabAsset();

        $response = $this->actingAs($user)->get('/dashboard');
        $response->assertOk();
        // Dashboard 'products' view-data is the regular-product count only.
        $response->assertViewHas('products', 1);
    }

    public function test_order_create_product_picker_excludes_lab_assets(): void
    {
        $user = User::factory()->create();
        $this->seedOneRegularAndOneLabAsset();

        $response = $this->actingAs($user)->get('/orders/create');
        $response->assertOk();
        $response->assertViewHas('products', function ($products) {
            $names = $products->pluck('name')->all();

            return in_array('Regular Widget', $names, true)
                && ! in_array('Lab Computer X', $names, true);
        });
    }

    public function test_search_results_exclude_lab_assets(): void
    {
        $this->seedOneRegularAndOneLabAsset();

        // SearchProduct (Livewire) wraps its or-where chain in a closure
        // inside the regularProducts() scope. We assert that same shape here
        // so the scope is exercised end-to-end without rendering Livewire.
        $matches = Product::regularProducts()
            ->where(function ($q) {
                $q->where('name', 'like', '%t%')
                    ->orWhere('code', 'like', '%t%')
                    ->orWhereHas('category', function ($c) {
                        $c->where('name', 'like', '%t%');
                    });
            })
            ->get();

        $names = $matches->pluck('name')->all();
        $this->assertContains('Regular Widget', $names);
        $this->assertNotContains('Lab Computer X', $names);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiProductControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_api_url()
    {
        $this->withoutExceptionHandling();

        $this->createProduct();

        $response = $this->get('api/products/');

        $response->assertStatus(200);
        $response->assertSee('Test Product');
        $response->assertDontSee('Test Product 2');
    }

    public function test_product_url_with_query_string()
    {
        $this->createProduct();

        $response = $this->get('api/products?category_id=1');

        $response->assertStatus(200);
        $response->assertSee('Test Product');
        $response->assertDontSee('Test Product 2');
    }

    public function test_public_api_excludes_sensitive_and_internal_fields()
    {
        Product::factory()->create([
            'name' => 'Test Product',
            'category_id' => $this->createCategory(),
            'unit_id' => $this->createUnit(),
            'buying_price' => 99,
            'notes' => 'SECRET-INTERNAL-NOTE',
            'serial_number' => 'SECRET-SERIAL-123',
        ]);

        $response = $this->get('api/products/');

        $response->assertStatus(200);

        // Sensitive values must never appear in the public response body.
        $response->assertDontSee('SECRET-INTERNAL-NOTE');
        $response->assertDontSee('SECRET-SERIAL-123');

        $product = $response->json()[0];

        // Whitelisted catalogue fields are present.
        $this->assertArrayHasKey('name', $product);
        $this->assertArrayHasKey('code', $product);
        $this->assertArrayHasKey('selling_price', $product);

        // Cost/margin and internal operational fields are excluded.
        foreach ([
            'buying_price', 'tax', 'tax_type', 'notes', 'specifications',
            'serial_number', 'asset_tag', 'scan_data', 'scan_confidence',
            'assigned_to', 'location', 'room', 'department', 'slug',
        ] as $hiddenField) {
            $this->assertArrayNotHasKey($hiddenField, $product);
        }
    }

    public function createProduct()
    {
        return Product::factory()->create([
            'name' => 'Test Product',
            'category_id' => $this->createCategory(),
            'unit_id' => $this->createUnit()
        ]);
    }

    public function createCategory()
    {
        return Category::factory()->create([
            'name' => 'Speakers'
        ]);
    }

    public function createUnit()
    {
        return Unit::factory()->create([
            'name' => 'piece'
        ]);
    }


}

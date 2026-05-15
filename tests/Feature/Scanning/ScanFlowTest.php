<?php

namespace Tests\Feature\Scanning;

use App\AI\MockVisionProvider;
use App\AI\VisionProvider;
use App\Models\Category;
use App\Models\PhotoScan;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ScanFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Per-test binding only. Global AppServiceProvider default is untouched.
        $this->app->bind(VisionProvider::class, MockVisionProvider::class);
        MockVisionProvider::reset();

        Storage::fake('public');
    }

    private function makeCategoryAndUnit(): array
    {
        $category = Category::factory()->create();
        $unit     = Unit::factory()->create();

        return [$category, $unit];
    }

    private function startScanSession(User $user, string $sessionType = 'lab_asset'): int
    {
        $response = $this->actingAs($user)->postJson('/api/scanning/start', [
            'session_type' => $sessionType,
            'location'     => 'Test Lab',
        ]);

        $response->assertOk();
        $response->assertJson(['success' => true]);

        return (int) $response->json('session_id');
    }

    private function uploadOnePhoto(User $user, int $sessionId): int
    {
        $response = $this->actingAs($user)->post('/api/scanning/upload', [
            'session_id' => $sessionId,
            'photo_type' => 'serial_label',
            'photo'      => UploadedFile::fake()->image('label.jpg'),
        ]);

        $response->assertOk();
        $response->assertJson(['success' => true]);

        return (int) $response->json('photo_scan_id');
    }

    public function test_upload_creates_a_completed_photo_scan_with_mock_ai(): void
    {
        $user = User::factory()->create();

        MockVisionProvider::nextResponse([
            'ocr_results'            => ['SN: TEST-XYZ'],
            'object_detection'       => [],
            'classification_results' => ['device_type' => 'laptop', 'category' => null],
            'confidence_score'       => 0.92,
            'extracted_serial'       => 'TEST-XYZ',
            'extracted_model'        => 'TestModel-200',
            'extracted_manufacturer' => 'TestCorp',
            'detected_condition'     => 'good',
            'missing_components'     => [],
        ]);

        $sessionId   = $this->startScanSession($user);
        $photoScanId = $this->uploadOnePhoto($user, $sessionId);

        $scan = PhotoScan::find($photoScanId);
        $this->assertNotNull($scan);
        $this->assertSame('completed', $scan->processing_status);
        $this->assertSame('TEST-XYZ', $scan->extracted_serial);
        $this->assertSame('TestModel-200', $scan->extracted_model);
        $this->assertSame('TestCorp', $scan->extracted_manufacturer);
        $this->assertNull($scan->error_message);
    }

    public function test_completing_a_session_creates_one_lab_asset_with_correct_fields(): void
    {
        $user                = User::factory()->create();
        [$category, $unit]   = $this->makeCategoryAndUnit();

        MockVisionProvider::nextResponse([
            'ocr_results'            => [],
            'object_detection'       => [],
            'classification_results' => [],
            'confidence_score'       => 0.97,
            'extracted_serial'       => 'LAB-001',
            'extracted_model'        => 'OptiPlex 7090',
            'extracted_manufacturer' => 'Dell',
            'detected_condition'     => 'good',
            'missing_components'     => [],
        ]);

        $sessionId = $this->startScanSession($user);
        $this->uploadOnePhoto($user, $sessionId);

        $response = $this->actingAs($user)->postJson("/api/scanning/session/{$sessionId}/complete", [
            'create_products' => true,
            'product_data'    => [
                'name'        => 'Test Lab Asset',
                'category_id' => $category->id,
                'unit_id'     => $unit->id,
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('session.products_created', 1);

        $product = Product::labAssets()->first();
        $this->assertNotNull($product, 'A lab_asset product should have been created.');
        $this->assertSame('lab_asset', $product->product_type);
        $this->assertSame('LAB-001', $product->serial_number);
        $this->assertSame('OptiPlex 7090', $product->model);
        $this->assertSame('Dell', $product->manufacturer);
        $this->assertEquals($category->id, $product->category_id);
        $this->assertEquals($unit->id, $product->unit_id);
    }

    public function test_completing_a_session_without_category_or_unit_fails_validation(): void
    {
        $user      = User::factory()->create();
        $sessionId = $this->startScanSession($user);

        $response = $this->actingAs($user)->postJson("/api/scanning/session/{$sessionId}/complete", [
            'create_products' => true,
            'product_data'    => [
                'name' => 'Should Not Save',
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors([
            'product_data.category_id',
            'product_data.unit_id',
        ]);
    }

    public function test_buying_price_and_selling_price_default_to_zero(): void
    {
        $user              = User::factory()->create();
        [$category, $unit] = $this->makeCategoryAndUnit();

        $sessionId = $this->startScanSession($user);
        $this->uploadOnePhoto($user, $sessionId);

        $this->actingAs($user)->postJson("/api/scanning/session/{$sessionId}/complete", [
            'create_products' => true,
            'product_data'    => [
                'name'        => 'Default Prices',
                'category_id' => $category->id,
                'unit_id'     => $unit->id,
            ],
        ])->assertOk();

        $product = Product::labAssets()->first();
        $this->assertNotNull($product);
        $this->assertEquals(0, $product->buying_price);
        $this->assertEquals(0, $product->selling_price);
    }

    public function test_assigned_to_can_be_empty_on_lab_asset_create(): void
    {
        $user              = User::factory()->create();
        [$category, $unit] = $this->makeCategoryAndUnit();

        $response = $this->actingAs($user)->post('/lab-assets', [
            'name'             => 'Manual Asset Without Assignee',
            'condition_status' => 'good',
            'category_id'      => $category->id,
            'unit_id'          => $unit->id,
            // assigned_to deliberately omitted entirely
        ]);

        $response->assertStatus(302);

        $product = Product::where('name', 'Manual Asset Without Assignee')->first();
        $this->assertNotNull($product, 'Lab asset should be created when assigned_to is omitted.');
        $this->assertNull($product->assigned_to);
        $this->assertNull($product->assignment_date);
        $this->assertEquals(0, $product->buying_price);
        $this->assertEquals(0, $product->selling_price);
        $this->assertSame('lab_asset', $product->product_type);
    }

    public function test_scanned_product_is_locked_to_product_type_lab_asset(): void
    {
        $user              = User::factory()->create();
        [$category, $unit] = $this->makeCategoryAndUnit();

        $sessionId = $this->startScanSession($user, 'lab_asset');
        $this->uploadOnePhoto($user, $sessionId);

        $this->actingAs($user)->postJson("/api/scanning/session/{$sessionId}/complete", [
            'create_products' => true,
            'product_data'    => [
                'name'        => 'Locked',
                'category_id' => $category->id,
                'unit_id'     => $unit->id,
            ],
        ])->assertOk();

        $product = Product::orderByDesc('id')->first();
        $this->assertSame('lab_asset', $product->product_type);

        // And confirm the regular-products scope does not include it
        $this->assertSame(0, Product::regularProducts()
            ->where('serial_number', $product->serial_number)
            ->count());
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\ScanningSession;
use App\Models\PhotoScan;
use App\Models\Product;
use App\Jobs\ProcessPhotoScan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ScanningController extends Controller
{
    public function startSession(Request $request)
    {
        $validated = $request->validate([
            'session_type' => 'required|in:lab_asset,regular_product',
            'location' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'device_info' => 'nullable|array'
        ]);

        $session = ScanningSession::create([
            'session_type' => $validated['session_type'],
            'user_id' => auth()->id(),
            'location' => $validated['location'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'device_info' => $validated['device_info'] ?? null,
            'status' => 'in_progress',
            'started_at' => now()
        ]);

        return response()->json([
            'success' => true,
            'session_id' => $session->id,
            'message' => 'Scanning session started successfully'
        ]);
    }

    public function uploadPhoto(Request $request)
    {
        $validated = $request->validate([
            'session_id' => 'required|exists:scanning_sessions,id',
            'photo' => 'required|image|mimes:jpeg,png,jpg|max:10240', // 10MB max
            'photo_type' => 'required|in:overview,serial_label,components,condition'
        ]);

        $session = ScanningSession::find($validated['session_id']);

        // Check if session belongs to current user
        if ($session->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to scanning session'
            ], 403);
        }

        // Check if session is still in progress
        if (!$session->isInProgress()) {
            return response()->json([
                'success' => false,
                'message' => 'Scanning session is not active'
            ], 400);
        }

        try {
            // Store the photo
            $file = $request->file('photo');
            $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('scans/' . $session->id, $filename, 'public');

            // Get image dimensions
            $imageSize = getimagesize($file->getPathname());
            $dimensions = $imageSize ? $imageSize[0] . 'x' . $imageSize[1] : null;

            // Create photo scan record
            $photoScan = PhotoScan::create([
                'scanning_session_id' => $session->id,
                'photo_path' => $path,
                'photo_type' => $validated['photo_type'],
                'file_size' => $file->getSize(),
                'dimensions' => $dimensions,
                'processing_status' => 'pending'
            ]);

            // Update session statistics
            $session->incrementPhotos();

            // Dispatch job to process the photo
            ProcessPhotoScan::dispatch($photoScan);

            return response()->json([
                'success' => true,
                'photo_scan_id' => $photoScan->id,
                'message' => 'Photo uploaded successfully and queued for processing'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload photo: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getSession(ScanningSession $session)
    {
        // Check if session belongs to current user
        if ($session->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to scanning session'
            ], 403);
        }

        $session->load(['photoScans', 'user']);

        return response()->json([
            'success' => true,
            'session' => [
                'id' => $session->id,
                'session_type' => $session->session_type,
                'status' => $session->status,
                'location' => $session->location,
                'notes' => $session->notes,
                'total_photos' => $session->total_photos,
                'processed_photos' => $session->processed_photos,
                'products_created' => $session->products_created,
                'products_updated' => $session->products_updated,
                'average_confidence' => $session->average_confidence,
                'progress_percentage' => $session->getProgressPercentage(),
                'duration' => $session->getDurationFormatted(),
                'started_at' => $session->started_at,
                'completed_at' => $session->completed_at,
                'photo_scans' => $session->photoScans->map(function ($scan) {
                    return [
                        'id' => $scan->id,
                        'photo_type' => $scan->photo_type,
                        'processing_status' => $scan->processing_status,
                        'confidence_score' => $scan->confidence_score,
                        'extracted_serial' => $scan->extracted_serial,
                        'extracted_model' => $scan->extracted_model,
                        'extracted_manufacturer' => $scan->extracted_manufacturer,
                        'detected_condition' => $scan->detected_condition,
                        'missing_components' => $scan->missing_components,
                        'error_message' => $scan->error_message,
                        'created_at' => $scan->created_at,
                        'processed_at' => $scan->processed_at
                    ];
                })
            ]
        ]);
    }

    public function completeSession(Request $request, ScanningSession $session)
    {
        // Check if session belongs to current user
        if ($session->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to scanning session'
            ], 403);
        }

        if (!$session->isInProgress()) {
            return response()->json([
                'success' => false,
                'message' => 'Session is not in progress'
            ], 400);
        }

        $validated = $request->validate([
            'create_products' => 'boolean',
            'product_data' => 'nullable|array',
            'product_data.*.name' => 'required_if:create_products,true|string|max:255',
            'product_data.*.category_id' => 'required_if:create_products,true|exists:categories,id',
            'product_data.*.unit_id' => 'required_if:create_products,true|exists:units,id'
        ]);

        try {
            // Create products if requested
            if ($validated['create_products'] ?? false) {
                $this->createProductsFromSession($session, $validated['product_data'] ?? []);
            }

            // Mark session as completed
            $session->markAsCompleted();

            return response()->json([
                'success' => true,
                'message' => 'Scanning session completed successfully',
                'session' => [
                    'id' => $session->id,
                    'status' => $session->status,
                    'products_created' => $session->products_created,
                    'average_confidence' => $session->average_confidence,
                    'duration' => $session->getDurationFormatted()
                ]
            ]);

        } catch (\Exception $e) {
            $session->markAsFailed($e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to complete session: ' . $e->getMessage()
            ], 500);
        }
    }

    public function cancelSession(ScanningSession $session)
    {
        // Check if session belongs to current user
        if ($session->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to scanning session'
            ], 403);
        }

        if (!$session->isInProgress()) {
            return response()->json([
                'success' => false,
                'message' => 'Session is not in progress'
            ], 400);
        }

        $session->markAsCancelled('Cancelled by user');

        return response()->json([
            'success' => true,
            'message' => 'Scanning session cancelled successfully'
        ]);
    }

    public function getPhotoScan(PhotoScan $photoScan)
    {
        // Check if photo scan belongs to current user's session
        if ($photoScan->scanningSession->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to photo scan'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'photo_scan' => [
                'id' => $photoScan->id,
                'photo_type' => $photoScan->photo_type,
                'processing_status' => $photoScan->processing_status,
                'confidence_score' => $photoScan->confidence_score,
                'file_size' => $photoScan->getFileSizeFormatted(),
                'dimensions' => $photoScan->dimensions,
                'processing_time' => $photoScan->getProcessingTimeFormatted(),
                'extracted_serial' => $photoScan->extracted_serial,
                'extracted_model' => $photoScan->extracted_model,
                'extracted_manufacturer' => $photoScan->extracted_manufacturer,
                'detected_condition' => $photoScan->detected_condition,
                'missing_components' => $photoScan->getMissingComponentsList(),
                'ocr_results' => $photoScan->getExtractedText(),
                'detected_objects' => $photoScan->getDetectedObjects(),
                'classification' => $photoScan->getClassificationResult(),
                'error_message' => $photoScan->error_message,
                'created_at' => $photoScan->created_at,
                'processed_at' => $photoScan->processed_at
            ]
        ]);
    }

    private function createProductsFromSession(ScanningSession $session, array $productData)
    {
        $completedScans = $session->photoScans()->completed()->get();
        
        // Group scans by extracted information to identify unique products
        $productGroups = $this->groupScansByProduct($completedScans);

        foreach ($productGroups as $group) {
            $this->createProductFromScans($session, $group, $productData);
        }
    }

    private function groupScansByProduct($scans)
    {
        $groups = [];
        
        foreach ($scans as $scan) {
            $key = $this->generateProductKey($scan);
            
            if (!isset($groups[$key])) {
                $groups[$key] = [];
            }
            
            $groups[$key][] = $scan;
        }
        
        return $groups;
    }

    private function generateProductKey(PhotoScan $scan): string
    {
        $serial = $scan->extracted_serial ?: 'unknown';
        $model = $scan->extracted_model ?: 'unknown';
        $manufacturer = $scan->extracted_manufacturer ?: 'unknown';
        
        return md5($serial . $model . $manufacturer);
    }

    private function createProductFromScans(ScanningSession $session, array $scans, array $productData)
    {
        $primaryScan = $scans[0]; // Use first scan as primary source
        
        // Find the best data from all scans
        $bestSerial = $this->getBestExtractedValue($scans, 'extracted_serial');
        $bestModel = $this->getBestExtractedValue($scans, 'extracted_model');
        $bestManufacturer = $this->getBestExtractedValue($scans, 'extracted_manufacturer');
        $bestCondition = $this->getBestExtractedValue($scans, 'detected_condition');
        
        // Generate product name
        $name = $this->generateProductName($bestManufacturer, $bestModel, $bestSerial);
        
        // Create product
        $product = Product::create([
            'name' => $name,
            'slug' => Str::slug($name . '-' . time()),
            'code' => $this->generateUniqueCode($session->session_type),
            'product_type' => $session->session_type,
            'serial_number' => $bestSerial,
            'model' => $bestModel,
            'manufacturer' => $bestManufacturer,
            'condition_status' => $bestCondition ?: 'good',
            'asset_status' => 'active',
            'quantity' => 1,
            'quantity_alert' => 1,
            'category_id' => $productData['category_id'] ?? 1,
            'unit_id' => $productData['unit_id'] ?? 1,
            'scan_confidence' => collect($scans)->avg('confidence_score'),
            'last_scanned' => now(),
            'scan_data' => $this->compileScanData($scans)
        ]);

        // Link scans to the product
        foreach ($scans as $scan) {
            $scan->update(['product_id' => $product->id]);
        }

        // Create missing components
        $this->createMissingComponentsFromScans($product, $scans);

        $session->incrementProductsCreated();
    }

    private function getBestExtractedValue(array $scans, string $field): ?string
    {
        $values = collect($scans)
            ->pluck($field)
            ->filter()
            ->countBy()
            ->sortDesc();

        return $values->keys()->first();
    }

    private function generateProductName(?string $manufacturer, ?string $model, ?string $serial): string
    {
        $parts = array_filter([$manufacturer, $model]);
        
        if (empty($parts)) {
            return 'Unknown Device ' . ($serial ? "({$serial})" : '');
        }
        
        $name = implode(' ', $parts);
        
        if ($serial) {
            $name .= " ({$serial})";
        }
        
        return $name;
    }

    private function generateUniqueCode(string $sessionType): string
    {
        $prefix = $sessionType === 'lab_asset' ? 'LA-' : 'PR-';
        
        do {
            $code = $prefix . strtoupper(Str::random(6));
        } while (Product::where('code', $code)->exists());

        return $code;
    }

    private function compileScanData(array $scans): array
    {
        return [
            'scan_count' => count($scans),
            'scan_types' => collect($scans)->pluck('photo_type')->unique()->values()->toArray(),
            'average_confidence' => collect($scans)->avg('confidence_score'),
            'scan_ids' => collect($scans)->pluck('id')->toArray()
        ];
    }

    private function createMissingComponentsFromScans(Product $product, array $scans)
    {
        $allMissingComponents = [];
        
        foreach ($scans as $scan) {
            if ($scan->missing_components) {
                $allMissingComponents = array_merge($allMissingComponents, $scan->missing_components);
            }
        }
        
        // Group and count missing components
        $componentCounts = collect($allMissingComponents)->countBy('component_type');
        
        foreach ($componentCounts as $componentType => $count) {
            // Only create if detected multiple times (higher confidence)
            if ($count >= 2) {
                $component = collect($allMissingComponents)
                    ->where('component_type', $componentType)
                    ->first();
                
                MissingComponent::create([
                    'product_id' => $product->id,
                    'component_type' => $componentType,
                    'component_name' => $component['component_name'] ?? $componentType,
                    'required' => $component['required'] ?? true,
                    'estimated_cost' => $component['estimated_cost'] ?? null,
                    'detected_by' => 'scan',
                    'detection_confidence' => min($count / count($scans), 1.0),
                    'status' => 'missing'
                ]);
            }
        }
    }
}


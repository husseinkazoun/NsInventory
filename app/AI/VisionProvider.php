<?php

namespace App\AI;

use App\Models\PhotoScan;

/**
 * Abstraction for an AI vision provider that analyses a PhotoScan and
 * returns normalised extraction results.
 *
 * The returned array's keys must match what PhotoScan::markAsCompleted()
 * expects:
 *   ocr_results            (array|null)
 *   object_detection       (array|null)
 *   classification_results (array|null)
 *   confidence_score       (float|null)
 *   extracted_serial       (string|null)
 *   extracted_model        (string|null)
 *   extracted_manufacturer (string|null)
 *   detected_condition     (string|null)
 *   missing_components     (array|null)
 *
 * Concrete implementations may add additional keys, but must not change
 * the shape above so the existing scan-save flow keeps working.
 */
interface VisionProvider
{
    public function analyze(PhotoScan $photoScan): array;
}

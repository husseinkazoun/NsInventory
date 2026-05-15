<?php

namespace App\AI;

use App\Models\PhotoScan;

/**
 * Deterministic test double for VisionProvider.
 *
 * Tests bind this in their setUp(), then optionally call
 * MockVisionProvider::nextResponse([...]) before each upload to assert that
 * specific extracted fields flow correctly through the pipeline.
 *
 * The "next response" is single-use — consumed on the next analyze() call.
 * If no override is set, analyze() returns ::defaultResponse() so basic
 * upload tests still work without per-test setup.
 *
 * The response shape mirrors OpenAIVisionService::analyzePhoto() and matches
 * what PhotoScan::markAsCompleted() expects.
 */
class MockVisionProvider implements VisionProvider
{
    private static ?array $nextResponse = null;

    public static function nextResponse(array $response): void
    {
        self::$nextResponse = $response;
    }

    public static function reset(): void
    {
        self::$nextResponse = null;
    }

    public function analyze(PhotoScan $photoScan): array
    {
        $response = self::$nextResponse ?? self::defaultResponse();
        self::$nextResponse = null;

        return $response;
    }

    public static function defaultResponse(): array
    {
        return [
            'ocr_results'            => ['MOCK OCR'],
            'object_detection'       => [],
            'classification_results' => ['device_type' => 'desktop', 'category' => null],
            'confidence_score'       => 0.95,
            'extracted_serial'       => 'MOCK-SERIAL-000',
            'extracted_model'        => 'MockModel-X',
            'extracted_manufacturer' => 'MockCorp',
            'detected_condition'     => 'good',
            'missing_components'     => [],
        ];
    }
}

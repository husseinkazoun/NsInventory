<?php

namespace App\AI;

use App\Models\PhotoScan;
use App\Services\OpenAIVisionService;

/**
 * Thin adapter: bridges the new VisionProvider interface to the existing
 * OpenAIVisionService implementation. No prompt logic or response parsing
 * is moved — that still lives in App\Services\OpenAIVisionService.
 */
class OpenAIVisionProvider implements VisionProvider
{
    public function __construct(private OpenAIVisionService $service)
    {
    }

    public function analyze(PhotoScan $photoScan): array
    {
        return $this->service->analyzePhoto($photoScan);
    }
}

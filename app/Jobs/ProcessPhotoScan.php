<?php

namespace App\Jobs;

use App\AI\VisionProvider;
use App\Models\PhotoScan;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessPhotoScan implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $photoScan;

    public function __construct(PhotoScan $photoScan)
    {
        $this->photoScan = $photoScan;
    }

    public function handle()
    {
        try {
            Log::info("Processing photo scan ID: {$this->photoScan->id}");
            
            $this->photoScan->markAsProcessing();
            
            $startTime = microtime(true);

            // Resolve the configured vision provider (default: OpenAI gpt-4o)
            $provider = app(VisionProvider::class);

            // Process the photo
            $results = $provider->analyze($this->photoScan);
            
            $processingTime = microtime(true) - $startTime;
            $results['processing_time'] = $processingTime;
            
            // Mark as completed with results
            $this->photoScan->markAsCompleted($results);
            
            // Update session statistics
            $this->photoScan->scanningSession->incrementProcessedPhotos();
            
            Log::info("Successfully processed photo scan ID: {$this->photoScan->id}");
            
        } catch (\Exception $e) {
            Log::error("Failed to process photo scan ID: {$this->photoScan->id}", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            $this->photoScan->markAsFailed($e->getMessage());
            
            // Optionally retry the job
            if ($this->attempts() < 3) {
                $this->release(60); // Retry after 60 seconds
            }
        }
    }

    public function failed(\Throwable $exception)
    {
        Log::error("Photo scan processing job failed permanently", [
            'photo_scan_id' => $this->photoScan->id,
            'error' => $exception->getMessage()
        ]);
        
        $this->photoScan->markAsFailed("Job failed: " . $exception->getMessage());
    }
}


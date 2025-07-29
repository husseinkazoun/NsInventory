<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PhotoScan extends Model
{
    use HasFactory;

    protected $fillable = [
        'scanning_session_id',
        'product_id',
        'photo_path',
        'photo_type',
        'file_size',
        'dimensions',
        'ocr_results',
        'object_detection',
        'classification_results',
        'confidence_score',
        'processing_status',
        'processing_time',
        'error_message',
        'extracted_serial',
        'extracted_model',
        'extracted_manufacturer',
        'detected_condition',
        'missing_components',
        'processed_at'
    ];

    protected $casts = [
        'ocr_results' => 'array',
        'object_detection' => 'array',
        'classification_results' => 'array',
        'missing_components' => 'array',
        'confidence_score' => 'decimal:2',
        'processing_time' => 'decimal:3',
        'created_at' => 'datetime',
        'processed_at' => 'datetime'
    ];

    public function scanningSession(): BelongsTo
    {
        return $this->belongsTo(ScanningSession::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('processing_status', 'pending');
    }

    public function scopeProcessing($query)
    {
        return $query->where('processing_status', 'processing');
    }

    public function scopeCompleted($query)
    {
        return $query->where('processing_status', 'completed');
    }

    public function scopeFailed($query)
    {
        return $query->where('processing_status', 'failed');
    }

    public function scopeByType($query, $type)
    {
        return $query->where('photo_type', $type);
    }

    public function scopeHighConfidence($query, $threshold = 0.8)
    {
        return $query->where('confidence_score', '>=', $threshold);
    }

    public function scopeLowConfidence($query, $threshold = 0.5)
    {
        return $query->where('confidence_score', '<', $threshold);
    }

    // Helper methods
    public function isPending(): bool
    {
        return $this->processing_status === 'pending';
    }

    public function isProcessing(): bool
    {
        return $this->processing_status === 'processing';
    }

    public function isCompleted(): bool
    {
        return $this->processing_status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->processing_status === 'failed';
    }

    public function isOverviewPhoto(): bool
    {
        return $this->photo_type === 'overview';
    }

    public function isSerialLabelPhoto(): bool
    {
        return $this->photo_type === 'serial_label';
    }

    public function isComponentsPhoto(): bool
    {
        return $this->photo_type === 'components';
    }

    public function isConditionPhoto(): bool
    {
        return $this->photo_type === 'condition';
    }

    public function hasHighConfidence(float $threshold = 0.8): bool
    {
        return $this->confidence_score >= $threshold;
    }

    public function hasLowConfidence(float $threshold = 0.5): bool
    {
        return $this->confidence_score < $threshold;
    }

    public function getFileSizeFormatted(): string
    {
        if (!$this->file_size) {
            return 'Unknown';
        }

        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, 2) . ' ' . $units[$i];
    }

    public function getProcessingTimeFormatted(): string
    {
        if (!$this->processing_time) {
            return 'N/A';
        }

        if ($this->processing_time < 1) {
            return round($this->processing_time * 1000) . 'ms';
        }

        return round($this->processing_time, 2) . 's';
    }

    public function getExtractedText(): array
    {
        return $this->ocr_results['text'] ?? [];
    }

    public function getDetectedObjects(): array
    {
        return $this->object_detection['objects'] ?? [];
    }

    public function getClassificationResult(): ?string
    {
        return $this->classification_results['category'] ?? null;
    }

    public function getMissingComponentsList(): array
    {
        return $this->missing_components ?? [];
    }

    public function markAsProcessing(): void
    {
        $this->update([
            'processing_status' => 'processing'
        ]);
    }

    public function markAsCompleted(array $results): void
    {
        $this->update([
            'processing_status' => 'completed',
            'processed_at' => now(),
            'ocr_results' => $results['ocr_results'] ?? null,
            'object_detection' => $results['object_detection'] ?? null,
            'classification_results' => $results['classification_results'] ?? null,
            'confidence_score' => $results['confidence_score'] ?? null,
            'extracted_serial' => $results['extracted_serial'] ?? null,
            'extracted_model' => $results['extracted_model'] ?? null,
            'extracted_manufacturer' => $results['extracted_manufacturer'] ?? null,
            'detected_condition' => $results['detected_condition'] ?? null,
            'missing_components' => $results['missing_components'] ?? null,
            'processing_time' => $results['processing_time'] ?? null
        ]);
    }

    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'processing_status' => 'failed',
            'processed_at' => now(),
            'error_message' => $errorMessage
        ]);
    }
}


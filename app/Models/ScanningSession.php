<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ScanningSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_type',
        'status',
        'user_id',
        'device_info',
        'total_photos',
        'processed_photos',
        'processing_time',
        'products_created',
        'products_updated',
        'average_confidence',
        'location',
        'notes',
        'started_at',
        'completed_at'
    ];

    protected $casts = [
        'device_info' => 'array',
        'processing_time' => 'decimal:3',
        'average_confidence' => 'decimal:2',
        'started_at' => 'datetime',
        'completed_at' => 'datetime'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function photoScans(): HasMany
    {
        return $this->hasMany(PhotoScan::class);
    }

    // Scopes
    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    public function scopeLabAssets($query)
    {
        return $query->where('session_type', 'lab_asset');
    }

    public function scopeRegularProducts($query)
    {
        return $query->where('session_type', 'regular_product');
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeToday($query)
    {
        return $query->whereDate('started_at', today());
    }

    public function scopeThisWeek($query)
    {
        return $query->whereBetween('started_at', [now()->startOfWeek(), now()->endOfWeek()]);
    }

    // Helper methods
    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public function isLabAssetSession(): bool
    {
        return $this->session_type === 'lab_asset';
    }

    public function isRegularProductSession(): bool
    {
        return $this->session_type === 'regular_product';
    }

    public function getProgressPercentage(): float
    {
        if ($this->total_photos === 0) {
            return 0;
        }

        return round(($this->processed_photos / $this->total_photos) * 100, 2);
    }

    public function getDurationInSeconds(): ?float
    {
        if (!$this->completed_at || !$this->started_at) {
            return null;
        }

        return $this->started_at->diffInSeconds($this->completed_at);
    }

    public function getDurationFormatted(): string
    {
        $duration = $this->getDurationInSeconds();
        
        if (!$duration) {
            return 'N/A';
        }

        if ($duration < 60) {
            return round($duration) . 's';
        }

        if ($duration < 3600) {
            return round($duration / 60) . 'm ' . round($duration % 60) . 's';
        }

        $hours = floor($duration / 3600);
        $minutes = floor(($duration % 3600) / 60);
        return $hours . 'h ' . $minutes . 'm';
    }

    public function markAsCompleted(): void
    {
        $this->update([
            'status' => 'completed',
            'completed_at' => now(),
            'average_confidence' => $this->calculateAverageConfidence()
        ]);
    }

    public function markAsFailed(string $reason = null): void
    {
        $this->update([
            'status' => 'failed',
            'completed_at' => now(),
            'notes' => $this->notes ? $this->notes . "\n\nFailed: " . $reason : "Failed: " . $reason
        ]);
    }

    public function markAsCancelled(string $reason = null): void
    {
        $this->update([
            'status' => 'cancelled',
            'completed_at' => now(),
            'notes' => $this->notes ? $this->notes . "\n\nCancelled: " . $reason : "Cancelled: " . $reason
        ]);
    }

    public function incrementPhotos(): void
    {
        $this->increment('total_photos');
    }

    public function incrementProcessedPhotos(): void
    {
        $this->increment('processed_photos');
    }

    public function incrementProductsCreated(): void
    {
        $this->increment('products_created');
    }

    public function incrementProductsUpdated(): void
    {
        $this->increment('products_updated');
    }

    private function calculateAverageConfidence(): float
    {
        return $this->photoScans()
            ->whereNotNull('confidence_score')
            ->avg('confidence_score') ?? 0;
    }
}


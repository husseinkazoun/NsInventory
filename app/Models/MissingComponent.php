<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class MissingComponent extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'component_type',
        'component_name',
        'required',
        'estimated_cost',
        'detected_by',
        'detection_confidence',
        'detected_at',
        'status',
        'order_date',
        'expected_delivery',
        'resolved_at',
        'resolved_by',
        'notes'
    ];

    protected $casts = [
        'required' => 'boolean',
        'estimated_cost' => 'decimal:2',
        'detection_confidence' => 'decimal:2',
        'detected_at' => 'datetime',
        'order_date' => 'date',
        'expected_delivery' => 'date',
        'resolved_at' => 'datetime'
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    // Scopes
    public function scopeMissing($query)
    {
        return $query->where('status', 'missing');
    }

    public function scopeOrdered($query)
    {
        return $query->where('status', 'ordered');
    }

    public function scopeResolved($query)
    {
        return $query->whereIn('status', ['received', 'installed']);
    }

    public function scopeRequired($query)
    {
        return $query->where('required', true);
    }

    public function scopeByDetectionMethod($query, $method)
    {
        return $query->where('detected_by', $method);
    }

    // Helper methods
    public function isMissing(): bool
    {
        return $this->status === 'missing';
    }

    public function isOrdered(): bool
    {
        return $this->status === 'ordered';
    }

    public function isResolved(): bool
    {
        return in_array($this->status, ['received', 'installed']);
    }

    public function isRequired(): bool
    {
        return $this->required;
    }

    public function isOverdue(): bool
    {
        return $this->expected_delivery && $this->expected_delivery < now() && !$this->isResolved();
    }

    public function getDaysOverdue(): int
    {
        if (!$this->isOverdue()) {
            return 0;
        }

        return now()->diffInDays($this->expected_delivery);
    }

    public function markAsOrdered(string $orderDate = null, string $expectedDelivery = null): void
    {
        $this->update([
            'status' => 'ordered',
            'order_date' => $orderDate ?? now()->toDateString(),
            'expected_delivery' => $expectedDelivery
        ]);
    }

    public function markAsReceived(int $resolvedBy = null): void
    {
        $this->update([
            'status' => 'received',
            'resolved_at' => now(),
            'resolved_by' => $resolvedBy ?? auth()->id()
        ]);
    }

    public function markAsInstalled(int $resolvedBy = null): void
    {
        $this->update([
            'status' => 'installed',
            'resolved_at' => now(),
            'resolved_by' => $resolvedBy ?? auth()->id()
        ]);
    }
}


<?php

namespace App\Models;

use App\Enums\TaxType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    public $fillable = [
        'name',
        'slug',
        'code',
        'product_type',
        'serial_number',
        'model',
        'manufacturer',
        'part_number',
        'quantity',
        'quantity_alert',
        'buying_price',
        'selling_price',
        'tax',
        'tax_type',
        'notes',
        'specifications',
        'product_image',
        'category_id',
        'unit_id',
        'asset_tag',
        'location',
        'room',
        'department',
        'assigned_to',
        'assignment_date',
        'condition_status',
        'asset_status',
        'last_maintenance',
        'next_maintenance',
        'warranty_expiry',
        'scan_data',
        'scan_confidence',
        'last_scanned',
        'created_at',
        'updated_at'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'assignment_date' => 'date',
        'last_maintenance' => 'date',
        'next_maintenance' => 'date',
        'warranty_expiry' => 'date',
        'last_scanned' => 'datetime',
        'specifications' => 'array',
        'scan_data' => 'array',
        'tax_type' => TaxType::class,
        'scan_confidence' => 'decimal:2'
    ];

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function missingComponents(): HasMany
    {
        return $this->hasMany(MissingComponent::class);
    }

    public function photoScans(): HasMany
    {
        return $this->hasMany(PhotoScan::class);
    }

    protected function buyingPrice(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value / 100,
            set: fn ($value) => $value * 100,
        );
    }

    protected function sellingPrice(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value / 100,
            set: fn ($value) => $value * 100,
        );
    }

    // Scopes
    public function scopeSearch($query, $value): void
    {
        $query->where('name', 'like', "%{$value}%")
            ->orWhere('code', 'like', "%{$value}%")
            ->orWhere('serial_number', 'like', "%{$value}%")
            ->orWhere('model', 'like', "%{$value}%")
            ->orWhere('manufacturer', 'like', "%{$value}%");
    }

    public function scopeLabAssets($query)
    {
        return $query->where('product_type', 'lab_asset');
    }

    public function scopeRegularProducts($query)
    {
        return $query->where('product_type', 'regular');
    }

    public function scopeAssignedTo($query, $userId)
    {
        return $query->where('assigned_to', $userId);
    }

    public function scopeInLocation($query, $location)
    {
        return $query->where('location', $location);
    }

    public function scopeByCondition($query, $condition)
    {
        return $query->where('condition_status', $condition);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('asset_status', $status);
    }

    // Helper methods
    public function isLabAsset(): bool
    {
        return $this->product_type === 'lab_asset';
    }

    public function isRegularProduct(): bool
    {
        return $this->product_type === 'regular';
    }

    public function hasAssignedUser(): bool
    {
        return !is_null($this->assigned_to);
    }

    public function hasMissingComponents(): bool
    {
        return $this->missingComponents()->where('status', 'missing')->exists();
    }

    public function getMissingComponentsCount(): int
    {
        return $this->missingComponents()->where('status', 'missing')->count();
    }

    public function needsMaintenance(): bool
    {
        return $this->next_maintenance && $this->next_maintenance <= now()->addDays(7);
    }

    public function isWarrantyExpiring(): bool
    {
        return $this->warranty_expiry && $this->warranty_expiry <= now()->addDays(30);
    }

    public function getSpecification(string $key, $default = null)
    {
        return $this->specifications[$key] ?? $default;
    }

    public function setSpecification(string $key, $value): void
    {
        $specifications = $this->specifications ?? [];
        $specifications[$key] = $value;
        $this->specifications = $specifications;
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Product type to distinguish between regular products and lab assets
            $table->enum('product_type', ['regular', 'lab_asset'])->default('regular')->after('name');
            
            // Hardware identification fields
            $table->string('serial_number')->nullable()->after('code');
            $table->string('model')->nullable()->after('serial_number');
            $table->string('manufacturer')->nullable()->after('model');
            $table->string('part_number')->nullable()->after('manufacturer');
            
            // Hardware specifications (JSON for flexibility)
            $table->json('specifications')->nullable()->after('notes');
            
            // Lab asset specific fields
            $table->string('asset_tag')->nullable()->unique()->after('specifications');
            $table->string('location')->nullable()->after('asset_tag');
            $table->string('room')->nullable()->after('location');
            $table->string('department')->nullable()->after('room');
            
            // Assignment tracking
            $table->unsignedBigInteger('assigned_to')->nullable()->after('department');
            $table->date('assignment_date')->nullable()->after('assigned_to');
            
            // Condition and status
            $table->enum('condition_status', ['excellent', 'good', 'fair', 'poor', 'broken'])->default('good')->after('assignment_date');
            $table->enum('asset_status', ['active', 'inactive', 'maintenance', 'disposed'])->default('active')->after('condition_status');
            
            // Maintenance tracking
            $table->date('last_maintenance')->nullable()->after('asset_status');
            $table->date('next_maintenance')->nullable()->after('last_maintenance');
            $table->date('warranty_expiry')->nullable()->after('next_maintenance');
            
            // Photo scanning metadata
            $table->json('scan_data')->nullable()->after('warranty_expiry');
            $table->decimal('scan_confidence', 3, 2)->nullable()->after('scan_data');
            $table->timestamp('last_scanned')->nullable()->after('scan_confidence');
            
            // Add foreign key for assigned user
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
            
            // Add indexes for better performance
            $table->index('product_type');
            $table->index('serial_number');
            $table->index('asset_tag');
            $table->index('location');
            $table->index('assigned_to');
            $table->index('asset_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Drop foreign key first
            $table->dropForeign(['assigned_to']);
            
            // Drop indexes
            $table->dropIndex(['product_type']);
            $table->dropIndex(['serial_number']);
            $table->dropIndex(['asset_tag']);
            $table->dropIndex(['location']);
            $table->dropIndex(['assigned_to']);
            $table->dropIndex(['asset_status']);
            
            // Drop columns
            $table->dropColumn([
                'product_type',
                'serial_number',
                'model',
                'manufacturer',
                'part_number',
                'specifications',
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
                'last_scanned'
            ]);
        });
    }
};


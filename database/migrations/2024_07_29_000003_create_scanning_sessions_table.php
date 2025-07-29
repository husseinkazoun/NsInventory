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
        Schema::create('scanning_sessions', function (Blueprint $table) {
            $table->id();
            
            // Session information
            $table->enum('session_type', ['lab_asset', 'regular_product'])->default('lab_asset');
            $table->enum('status', ['in_progress', 'completed', 'failed', 'cancelled'])->default('in_progress');
            
            // User and device information
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->json('device_info')->nullable(); // Camera/device information
            
            // Processing statistics
            $table->integer('total_photos')->default(0);
            $table->integer('processed_photos')->default(0);
            $table->decimal('processing_time', 8, 3)->nullable(); // seconds
            
            // Results
            $table->integer('products_created')->default(0);
            $table->integer('products_updated')->default(0);
            $table->decimal('average_confidence', 3, 2)->nullable(); // Average confidence score
            
            // Location and metadata
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            
            // Timestamps
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('session_type');
            $table->index('user_id');
            $table->index('status');
            $table->index('started_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scanning_sessions');
    }
};


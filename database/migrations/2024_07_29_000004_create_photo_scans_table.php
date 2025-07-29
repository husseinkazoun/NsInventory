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
        Schema::create('photo_scans', function (Blueprint $table) {
            $table->id();
            
            // Link to scanning session and product
            $table->foreignId('scanning_session_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained()->onDelete('set null');
            
            // Photo information
            $table->string('photo_path', 500);
            $table->enum('photo_type', ['overview', 'serial_label', 'components', 'condition']);
            $table->integer('file_size')->nullable();
            $table->string('dimensions', 20)->nullable(); // e.g., "1920x1080"
            
            // AI processing results
            $table->json('ocr_results')->nullable(); // Text extraction results
            $table->json('object_detection')->nullable(); // Detected objects/components
            $table->json('classification_results')->nullable(); // Item type/category classification
            $table->decimal('confidence_score', 3, 2)->nullable();
            
            // Processing status
            $table->enum('processing_status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
            $table->decimal('processing_time', 6, 3)->nullable(); // seconds
            $table->text('error_message')->nullable();
            
            // Extracted information
            $table->string('extracted_serial')->nullable();
            $table->string('extracted_model')->nullable();
            $table->string('extracted_manufacturer')->nullable();
            $table->enum('detected_condition', ['excellent', 'good', 'fair', 'poor', 'broken'])->nullable();
            $table->json('missing_components')->nullable();
            
            // Timestamps
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('processed_at')->nullable();
            
            // Indexes
            $table->index('scanning_session_id');
            $table->index('product_id');
            $table->index('photo_type');
            $table->index('processing_status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('photo_scans');
    }
};


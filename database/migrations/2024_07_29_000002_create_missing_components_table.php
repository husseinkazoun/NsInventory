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
        Schema::create('missing_components', function (Blueprint $table) {
            $table->id();
            
            // Link to product (lab asset)
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            
            // Component information
            $table->string('component_type'); // 'power_cable', 'network_cable', 'mouse', 'keyboard', etc.
            $table->string('component_name');
            $table->boolean('required')->default(true);
            $table->decimal('estimated_cost', 8, 2)->nullable();
            
            // Detection information
            $table->enum('detected_by', ['scan', 'manual', 'audit'])->default('scan');
            $table->decimal('detection_confidence', 3, 2)->nullable(); // 0.00 to 1.00
            $table->timestamp('detected_at')->useCurrent();
            
            // Resolution tracking
            $table->enum('status', ['missing', 'ordered', 'received', 'installed'])->default('missing');
            $table->date('order_date')->nullable();
            $table->date('expected_delivery')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->onDelete('set null');
            
            $table->text('notes')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index(['product_id', 'component_type']);
            $table->index('status');
            $table->index('detected_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('missing_components');
    }
};


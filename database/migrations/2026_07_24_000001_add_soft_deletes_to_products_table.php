<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make product deletion recoverable.
 *
 * A deleted product now only gets a deleted_at timestamp (Trash) instead of
 * being removed outright, so an accidental delete can be undone and the
 * product image and raw scan photos are left untouched.
 *
 * Adding the column changes no existing row: every current product keeps
 * deleted_at NULL and therefore stays visible everywhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};

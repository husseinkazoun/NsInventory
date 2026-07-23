<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 1 of the administrator-role work: introduce the flag only.
 *
 * The column is non-nullable and defaults to false, so applying this migration
 * promotes nobody — every existing and future account starts as a non-admin.
 * Administrators are granted explicitly and deliberately, never by a migration
 * or a seeder. Nothing enforces this flag yet.
 *
 * Rollback is a plain column drop (see down()); no data is written or removed,
 * so rolling back cannot lose account information.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
        });
    }
};

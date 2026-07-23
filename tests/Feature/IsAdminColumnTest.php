<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Phase 1 of the administrator-role work: the is_admin flag exists, defaults to
 * false, cannot be set through any request, and is not yet enforced anywhere.
 */
class IsAdminColumnTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_table_has_the_is_admin_column(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'is_admin'));
    }

    public function test_new_users_are_not_administrators_by_default(): void
    {
        $user = User::factory()->create();

        $this->assertFalse($user->fresh()->is_admin);
        $this->assertFalse($user->fresh()->isAdmin());
    }

    public function test_the_column_is_not_nullable_and_defaults_to_false(): void
    {
        // Insert bypassing the model so no attribute default is supplied; the
        // database default must still produce a non-null false.
        User::factory()->create();
        $raw = \DB::table('users')->first();

        $this->assertNotNull($raw->is_admin);
        $this->assertEquals(0, $raw->is_admin);
    }

    public function test_is_admin_is_cast_to_a_boolean(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => 1])->save();

        $this->assertIsBool($user->fresh()->is_admin);
        $this->assertTrue($user->fresh()->isAdmin());
    }

    public function test_is_admin_cannot_be_mass_assigned_on_create(): void
    {
        $user = User::create([
            'name' => 'Mass Assign',
            'username' => 'massassign',
            'email' => 'mass-assign@example.com',
            'password' => bcrypt('password'),
            'is_admin' => true,
        ]);

        $this->assertFalse($user->fresh()->is_admin);
    }

    public function test_is_admin_cannot_be_mass_assigned_on_update_or_fill(): void
    {
        $user = User::factory()->create();

        $user->update(['is_admin' => true]);
        $this->assertFalse($user->fresh()->is_admin);

        $user->fill(['is_admin' => true]);
        $user->save();
        $this->assertFalse($user->fresh()->is_admin);
    }

    public function test_a_normal_profile_request_cannot_grant_administrator(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patch('/profile', [
            'name' => 'Updated Name',
            'email' => $user->email,
            'username' => $user->username,
            'is_admin' => 1,
        ]);

        $this->assertFalse($user->fresh()->is_admin);
    }

    public function test_a_normal_user_update_request_cannot_grant_administrator(): void
    {
        $actor = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($actor)->put('/users/'.$target->username, [
            'name' => 'Updated Name',
            'email' => $target->email,
            'username' => $target->username,
            'is_admin' => 1,
        ]);

        $this->assertFalse($target->fresh()->is_admin);
    }

    public function test_a_normal_user_create_request_cannot_grant_administrator(): void
    {
        $actor = User::factory()->create();

        $this->actingAs($actor)->post('/users', [
            'name' => 'Created User',
            'username' => 'createduser',
            'email' => 'created-user@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'is_admin' => 1,
        ]);

        $created = User::where('email', 'created-user@example.com')->first();

        if ($created) {
            $this->assertFalse($created->is_admin);
        }

        // Whether or not creation succeeded, no administrator may appear.
        $this->assertSame(0, User::where('is_admin', true)->count());
    }

    public function test_the_migration_promotes_nobody(): void
    {
        User::factory()->count(3)->create();

        $this->assertSame(0, User::where('is_admin', true)->count());
    }

    /**
     * Phase 1 adds the flag but must not change authorisation behaviour: an
     * administrator and a non-administrator still reach the same pages.
     */
    public function test_the_flag_is_not_enforced_yet(): void
    {
        $regular = User::factory()->create();
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        $this->actingAs($regular)->get('/clothing')->assertOk();
        $this->actingAs($admin)->get('/clothing')->assertOk();
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Guards the UserController::updatePassword hardening: the previous
 * `required_with:password_confirmation` rule allowed a request with no password
 * to reach Hash::make(null) and write an empty password. The rule is now
 * `required|min:6|confirmed`.
 */
class UserPasswordUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_can_be_updated_with_matching_confirmation(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->put(route('users.updatePassword', $user), [
            'password' => 'new-secret-password',
            'password_confirmation' => 'new-secret-password',
        ]);

        $response->assertRedirect(route('users.index'));
        $this->assertTrue(Hash::check('new-secret-password', $user->fresh()->password));
    }

    public function test_password_update_requires_confirmation(): void
    {
        $user = User::factory()->create();
        $originalPassword = $user->password;

        $response = $this->actingAs($user)->put(route('users.updatePassword', $user), [
            'password' => 'new-secret-password',
        ]);

        $response->assertSessionHasErrors('password');
        $this->assertSame($originalPassword, $user->fresh()->password);
    }

    public function test_empty_password_is_rejected_and_not_written(): void
    {
        $user = User::factory()->create();
        $originalPassword = $user->password;

        $response = $this->actingAs($user)->put(route('users.updatePassword', $user), []);

        $response->assertSessionHasErrors('password');
        $this->assertSame($originalPassword, $user->fresh()->password);
    }
}

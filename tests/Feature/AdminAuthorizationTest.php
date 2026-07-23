<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 2: user management is administrators-only.
 *
 * Guests are redirected to login (auth runs before admin), signed-in
 * non-administrators get 403, and everything a normal user legitimately needs
 * — their own profile, their own password, inventory, products, orders —
 * stays reachable.
 */
class AdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_admin' => true])->save();

        return $user->fresh();
    }

    private function regular(): User
    {
        return User::factory()->create();
    }

    /** The management routes, as (method, uri) pairs. */
    public static function managementRoutes(): array
    {
        return [
            'index' => ['get', '/users'],
            'create' => ['get', '/users/create'],
            'store' => ['post', '/users'],
        ];
    }

    // ---------------------------------------------------------------- guests

    public function test_guests_are_redirected_to_login_not_given_a_403(): void
    {
        $this->get('/users')->assertRedirect('/login');
        $this->get('/users/create')->assertRedirect('/login');
    }

    // ------------------------------------------------------------ non-admins

    public function test_non_admins_get_403_on_every_user_management_route(): void
    {
        $regular = $this->regular();
        $target = $this->regular();

        $this->actingAs($regular)->get('/users')->assertForbidden();
        $this->actingAs($regular)->get('/users/create')->assertForbidden();
        $this->actingAs($regular)->post('/users', [])->assertForbidden();
        $this->actingAs($regular)->get('/users/'.$target->username)->assertForbidden();
        $this->actingAs($regular)->get('/users/'.$target->username.'/edit')->assertForbidden();
        $this->actingAs($regular)->put('/users/'.$target->username, [])->assertForbidden();
        $this->actingAs($regular)->delete('/users/'.$target->username)->assertForbidden();
    }

    public function test_non_admins_cannot_reset_another_users_password(): void
    {
        $regular = $this->regular();
        $target = $this->regular();
        $originalPassword = $target->password;

        $this->actingAs($regular)
            ->put('/user/change-password/'.$target->username, [
                'password' => 'hijacked-password',
                'password_confirmation' => 'hijacked-password',
            ])
            ->assertForbidden();

        $this->assertSame($originalPassword, $target->fresh()->password);
    }

    public function test_non_admins_do_not_see_the_users_navigation_link(): void
    {
        $response = $this->actingAs($this->regular())->get('/clothing');

        $response->assertOk();
        $response->assertDontSee(route('users.index'));
    }

    // --------------------------------------------------------------- admins

    public function test_admins_can_reach_user_management(): void
    {
        $admin = $this->admin();
        $target = $this->regular();

        $this->actingAs($admin)->get('/users')->assertOk();
        $this->actingAs($admin)->get('/users/create')->assertOk();
        $this->actingAs($admin)->get('/users/'.$target->username.'/edit')->assertOk();
    }

    public function test_admins_see_the_users_navigation_link(): void
    {
        $response = $this->actingAs($this->admin())->get('/clothing');

        $response->assertOk();
        $response->assertSee(route('users.index'));
    }

    public function test_admins_can_reset_another_users_password(): void
    {
        $admin = $this->admin();
        $target = $this->regular();
        $originalPassword = $target->password;

        $this->actingAs($admin)
            ->put('/user/change-password/'.$target->username, [
                'password' => 'a-new-password',
                'password_confirmation' => 'a-new-password',
            ])
            ->assertRedirect(route('users.index'));

        $this->assertNotSame($originalPassword, $target->fresh()->password);
    }

    // ------------------------------------------------ non-admin keeps access

    public function test_non_admins_keep_their_own_profile_and_password(): void
    {
        $regular = $this->regular();

        $this->actingAs($regular)->get('/profile')->assertOk();
        $this->actingAs($regular)->get('/profile/settings')->assertOk();

        // A deliberately alpha_dash-clean username: the profile rules require it,
        // and the factory's faker usernames can contain dots.
        $this->actingAs($regular)->patch('/profile', [
            'name' => 'My New Name',
            'email' => $regular->email,
            'username' => 'valid-username',
        ])->assertRedirect();

        $this->assertSame('My New Name', $regular->fresh()->name);

        // Self-service password change stays available (password.update).
        $this->actingAs($regular)->put('/password', [
            'current_password' => 'password',
            'password' => 'my-new-password',
            'password_confirmation' => 'my-new-password',
        ])->assertSessionHasNoErrors();
    }

    public function test_non_admins_keep_inventory_products_and_orders(): void
    {
        $regular = $this->regular();

        $this->actingAs($regular)->get('/clothing')->assertOk();
        $this->actingAs($regular)->get('/products')->assertOk();
        $this->actingAs($regular)->get('/orders')->assertOk();
    }

    // ------------------------------------------- mass-assignment protection

    public function test_an_admin_request_still_cannot_grant_the_admin_flag(): void
    {
        $admin = $this->admin();
        $target = $this->regular();

        $this->actingAs($admin)->put('/users/'.$target->username, [
            'name' => 'Updated',
            'email' => $target->email,
            'username' => $target->username,
            'is_admin' => 1,
        ]);

        $this->assertFalse($target->fresh()->is_admin);
        $this->assertSame(1, User::where('is_admin', true)->count());
    }

    // ------------------------------------------- sole-admin delete protection

    public function test_the_only_administrator_cannot_be_deleted(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->delete('/users/'.$admin->username);

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertSame(1, User::where('is_admin', true)->count());
    }

    public function test_the_only_administrator_cannot_delete_their_own_account(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->delete('/profile', [
            'password' => 'password',
        ]);

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertAuthenticatedAs($admin->fresh());
    }

    public function test_an_administrator_can_be_deleted_while_another_remains(): void
    {
        $first = $this->admin();
        $second = $this->admin();

        $this->actingAs($first)->delete('/users/'.$second->username);

        $this->assertDatabaseMissing('users', ['id' => $second->id]);
        $this->assertSame(1, User::where('is_admin', true)->count());
    }

    public function test_a_non_administrator_can_still_be_deleted(): void
    {
        $admin = $this->admin();
        $target = $this->regular();

        $this->actingAs($admin)->delete('/users/'.$target->username);

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }
}

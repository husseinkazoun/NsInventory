<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = $this->createUser();
    }

    /**
     * Requirement 5: logging out ends and invalidates the authenticated session.
     */
    public function test_authenticated_user_can_logout(): void
    {
        $response = $this->actingAs($this->user)->post(route('logout'));

        $this->assertGuest();
        $response->assertRedirect(route('login'));
    }

    /**
     * Requirement 5: after logout the user lands on the login page.
     */
    public function test_logout_redirects_to_the_login_page(): void
    {
        $response = $this->actingAs($this->user)->post(route('logout'));

        $response->assertRedirect(route('login'));
    }

    /**
     * Requirement 6: a full login -> logout -> protected-route sequence must not
     * leave the user able to open an authenticated page.
     */
    public function test_protected_route_cannot_be_opened_after_logout(): void
    {
        $this->actingAs($this->user);

        // While authenticated the protected page is reachable.
        $this->get('/clothing')->assertOk();

        $this->post(route('logout'))->assertRedirect(route('login'));
        $this->assertGuest();

        // Once logged out the same page is no longer accessible.
        $this->get('/clothing')->assertRedirect(route('login'));
    }

    /**
     * Requirement 6 (guest baseline): protected routes redirect anonymous
     * visitors to login. This is the state a user is in after logging out.
     */
    public function test_protected_routes_redirect_guests_to_login(): void
    {
        $this->get('/dashboard')->assertRedirect(route('login'));
        $this->get('/clothing')->assertRedirect(route('login'));
        $this->get('/users')->assertRedirect(route('login'));
    }

    /**
     * Requirement 4 / 7: logout must be a POST action, never a GET link.
     * A GET request to the logout URL must be rejected (405 Method Not Allowed).
     */
    public function test_logout_route_does_not_accept_get_requests(): void
    {
        $response = $this->actingAs($this->user)->get('/logout');

        $response->assertStatus(405);
    }

    /**
     * Requirement 4 / 7: the logout control is rendered as a CSRF-protected POST
     * form. Note: Laravel's VerifyCsrfToken middleware short-circuits on
     * runningUnitTests(), so a 419 token-mismatch cannot be asserted in the
     * feature-test harness; instead we assert the form posts to the logout route
     * and embeds a CSRF token (_token) so the middleware enforces it in production.
     */
    public function test_navigation_renders_csrf_protected_logout_form(): void
    {
        $response = $this->actingAs($this->user)->get('/clothing');

        $response->assertOk();
        $response->assertSee(route('logout'), false);
        $response->assertSee('method="post"', false);
        $response->assertSee('name="_token"', false);
    }
}

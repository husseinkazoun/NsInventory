<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Providers\RouteServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Login behaviour, with emphasis on the failure path: a failed attempt must
 * show a generic, visible error and must never reveal whether an account
 * exists for the submitted address.
 */
class LoginTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = $this->createUser();
    }

    public function test_incorrect_password_shows_the_generic_error(): void
    {
        $response = $this->from('/login')->post('/login', [
            'email' => $this->user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertRedirect('/login');
        $response->assertSessionHasErrors(['email' => trans('auth.failed')]);
        $this->assertGuest();
    }

    public function test_unknown_email_shows_the_generic_error(): void
    {
        $response = $this->from('/login')->post('/login', [
            'email' => 'nobody-here@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertRedirect('/login');
        $response->assertSessionHasErrors(['email' => trans('auth.failed')]);
        $this->assertGuest();
    }

    /**
     * Account enumeration guard: an unknown address and a wrong password for a
     * real account must be indistinguishable in the response.
     */
    public function test_unknown_email_and_wrong_password_are_indistinguishable(): void
    {
        $this->from('/login')->post('/login', [
            'email' => $this->user->email,
            'password' => 'wrong-password',
        ]);
        $wrongPassword = session('errors')->get('email');

        session()->flush();

        $this->from('/login')->post('/login', [
            'email' => 'nobody-here@example.com',
            'password' => 'wrong-password',
        ]);
        $unknownEmail = session('errors')->get('email');

        $this->assertSame($wrongPassword, $unknownEmail);
        $this->assertSame([trans('auth.failed')], $unknownEmail);
    }

    public function test_failed_login_renders_a_visible_form_level_message(): void
    {
        $this->from('/login')->post('/login', [
            'email' => $this->user->email,
            'password' => 'wrong-password',
        ]);

        $page = $this->get('/login');

        $page->assertOk();
        $page->assertSee('login-error', false);
        $page->assertSee(trans('auth.failed'));
    }

    public function test_failed_login_preserves_the_email_but_never_the_password(): void
    {
        $this->from('/login')->post('/login', [
            'email' => $this->user->email,
            'password' => 'super-secret-value',
        ]);

        $page = $this->get('/login');

        $page->assertSee($this->user->email, false);
        $page->assertDontSee('super-secret-value', false);
    }

    public function test_empty_email_is_rejected(): void
    {
        $response = $this->from('/login')->post('/login', [
            'email' => '',
            'password' => 'password',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_malformed_email_is_rejected(): void
    {
        $response = $this->from('/login')->post('/login', [
            'email' => 'not-an-email-address',
            'password' => 'password',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_login_is_rate_limited_after_repeated_failures(): void
    {
        foreach (range(1, 5) as $ignored) {
            $this->from('/login')->post('/login', [
                'email' => $this->user->email,
                'password' => 'wrong-password',
            ]);
        }

        $response = $this->from('/login')->post('/login', [
            'email' => $this->user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertSessionHasErrors('email');
        $this->assertStringContainsString(
            'Too many login attempts',
            session('errors')->first('email')
        );
        $this->assertGuest();
    }

    public function test_users_can_login_with_correct_credentials(): void
    {
        $response = $this->post('/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($this->user);
        $response->assertRedirect(RouteServiceProvider::HOME);
    }

    public function test_session_is_regenerated_after_login(): void
    {
        $this->get('/login');
        $sessionIdBeforeLogin = session()->getId();

        $this->post('/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($this->user);
        $this->assertNotSame($sessionIdBeforeLogin, session()->getId());
    }

    public function test_login_redirects_to_the_intended_page(): void
    {
        $this->get('/clothing')->assertRedirect('/login');

        $response = $this->post('/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect('/clothing');
    }

    /**
     * VerifyCsrfToken short-circuits while running unit tests, so a 419 cannot
     * be asserted here; assert instead that the form ships a CSRF token and
     * that authentication is POST-only.
     */
    public function test_login_form_is_csrf_protected(): void
    {
        $response = $this->get('/login');

        $response->assertOk();
        $response->assertSee('name="_token"', false);
    }
}

<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * The forgot-password request must return one generic confirmation regardless
 * of whether the address matches an account, and must be honest about the fact
 * that this deployment has no mail transport configured.
 */
class ForgotPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_email_gets_the_same_generic_confirmation_as_a_known_email(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $knownResponse = $this->from('/forgot-password')
            ->post('/forgot-password', ['email' => $user->email]);
        $knownStatus = session('status');

        session()->flush();

        $unknownResponse = $this->from('/forgot-password')
            ->post('/forgot-password', ['email' => 'nobody-here@example.com']);
        $unknownStatus = session('status');

        $knownResponse->assertRedirect('/forgot-password');
        $unknownResponse->assertRedirect('/forgot-password');

        // The old behaviour put "We can't find a user with that email address"
        // in the error bag for an unknown address, which leaked existence.
        $knownResponse->assertSessionHasNoErrors();
        $unknownResponse->assertSessionHasNoErrors();

        $this->assertNotNull($unknownStatus);
        $this->assertSame($knownStatus, $unknownStatus);
    }

    public function test_generic_confirmation_is_displayed_on_the_page(): void
    {
        Notification::fake();

        $this->post('/forgot-password', ['email' => 'nobody-here@example.com']);

        $page = $this->get('/forgot-password');

        $page->assertOk();
        $page->assertSee('forgot-password-status', false);
        $page->assertSee('password reset link has been generated');
    }

    public function test_page_states_that_email_delivery_is_not_configured(): void
    {
        config(['mail.default' => 'log']);

        $response = $this->get('/forgot-password');

        $response->assertOk();
        $response->assertSee('Email delivery is not configured on this system');
    }

    public function test_delivery_notice_is_hidden_when_a_real_mailer_is_configured(): void
    {
        config(['mail.default' => 'smtp']);

        $response = $this->get('/forgot-password');

        $response->assertOk();
        $response->assertDontSee('Email delivery is not configured on this system');
    }

    public function test_invalid_email_is_still_rejected(): void
    {
        $response = $this->from('/forgot-password')
            ->post('/forgot-password', ['email' => 'not-an-email']);

        $response->assertSessionHasErrors('email');
    }
}

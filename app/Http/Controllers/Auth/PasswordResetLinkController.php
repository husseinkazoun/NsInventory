<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\View\View;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): View
    {
        return view('auth.forgot-password');
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        // Attempt the reset link, but deliberately do NOT reflect the outcome in
        // the response: returning a different message for a known vs unknown
        // address reveals whether an account exists. The broker still applies
        // its own throttling internally.
        Password::sendResetLink(
            $request->only('email')
        );

        return back()->with('status', __(
            'If that email address matches an account, a password reset link has been generated.'
        ));
    }
}

@extends('layouts.auth')

@section('content')
<form class="card card-md" action="{{ route('password.email') }}" method="post" autocomplete="off" novalidate>
    @csrf

    <div class="card-body">
        <h2 class="card-title text-center mb-4">
            Forgot password
        </h2>

        <p class="text-secondary mb-4">
            Enter your email address and a password reset link will be generated for your account.
        </p>

        {{-- Generic confirmation: identical for a known and an unknown address,
             so the page never reveals whether an account exists. --}}
        @if (session('status'))
            <div class="alert alert-success" role="alert" data-testid="forgot-password-status">
                {{ session('status') }}
            </div>
        @endif

        {{-- Be explicit that the link will not arrive by email on deployments
             where no real mail transport is configured (production uses the log
             mailer), so nobody waits for a message that will never be sent. --}}
        @if (in_array(config('mail.default'), ['log', 'array'], true))
            <div class="alert alert-warning" role="alert" data-testid="mail-not-configured">
                <strong>Email delivery is not configured on this system.</strong>
                The reset link is recorded on the server rather than emailed, so it
                will not arrive in your inbox — ask an administrator to retrieve it
                for you.
            </div>
        @endif

        <div class="mb-3">
            <label for="email" class="form-label">
                Email address
            </label>
            <input type="email" name="email" id="email"
                   class="form-control @error('email') is-invalid @enderror"
                   placeholder="Enter email"
            >

            @error('email')
            <div class="invalid-feedback">
                {{ $message }}
            </div>
            @enderror
        </div>
        <div class="form-footer">
            <button type="submit" class="btn btn-primary w-100">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg>
                Request password reset
            </button>
        </div>
    </div>
</form>
<div class="text-center text-secondary mt-3">
    Forget it, <a href="{{ route('login') }}">send me back</a> to the sign in screen.
</div>
@endsection

@extends('layouts.auth')

@section('content')
<div class="card card-md">
    <div class="card-body">
        <h2 class="h2 text-center mb-4">
            Login to your account
        </h2>

        {{-- Form-level message: keeps failures understandable even if the
             per-field rendering changes (or a message is keyed to a field that
             is not displayed). Shows the same generic text for a wrong password
             and an unknown address. --}}
        @if ($errors->any())
            <div class="alert alert-danger" role="alert" data-testid="login-error">
                {{ $errors->first() }}
            </div>
        @endif

        <form action="{{ route('login') }}" method="POST" autocomplete="off">
            @csrf

            <x-input name="email" :value="old('email')" placeholder="your@email.com" required="true"/>

            {{-- :value="null" so the password is never repopulated after a
                 failed attempt (the component would otherwise default to
                 old('password')). --}}
            <x-input type="password" name="password" :value="null" placeholder="Your password" required="true"/>

            <div class="mb-2">
                <label for="remember" class="form-check">
                    <input type="checkbox" id="remember" name="remember" class="form-check-input"/>
                    <span class="form-check-label">Remember me on this device</span>
                </label>
            </div>

            <div class="form-footer">
                <x-button type="submit" class="w-100">
                    {{ __('Sign in') }}
                </x-button>
            </div>
        </form>
    </div>
</div>

<div class="text-center mt-3 text-gray-600">
    @if (Route::has('register'))
        <p>Don't have an account yet?
            <a href="{{ route('register') }}" class="text-blue-500 hover:text-blue-700 focus:outline-none focus:underline" tabindex="-1">
                Sign up
            </a>
        </p>
    @endif

    <p class="mt-2">
        <a href="{{ route('password.request') }}" class="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline">
            I forgot my password
        </a>
    </p>
</div>

@endsection

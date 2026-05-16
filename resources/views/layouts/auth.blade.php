<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
    <meta http-equiv="X-UA-Compatible" content="ie=edge"/>
    <title>{{ config('app.name') }}</title>

    <link rel="icon" type="image/svg+xml" href="{{ asset('icons/sanad-inventory-favicon.svg') }}">
    <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('icons/sanad-inventory-32.png') }}">
    <link rel="icon" type="image/png" sizes="16x16" href="{{ asset('icons/sanad-inventory-16.png') }}">
    <link rel="shortcut icon" href="{{ asset('favicon.ico') }}">
    <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('icons/apple-touch-icon.png') }}">
    <link rel="manifest" href="{{ asset('icons/site.webmanifest') }}">
    <meta name="theme-color" content="#0B1A33">

    <!-- Fonts: Inter (Latin) + IBM Plex Sans Arabic -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">

    <!-- CSS files -->
    <link href="{{ asset('dist/css/tabler.min.css') }}" rel="stylesheet"/>
    <link href="{{ asset('static/brand.css') }}" rel="stylesheet"/>
    <style>
        body { font-feature-settings: "cv03", "cv04", "cv11"; }
    </style>

    <!-- Custom CSS for specific page.  -->
    @stack('page-styles')
</head>

<body class=" d-flex flex-column">
    <div class="page page-center">
        <div class="container container-tight py-4">
            <div class="text-center mb-4">
                <a href="{{ url('/') }}" class="ns-brand-link" aria-label="Sanad Smart Inventory System home">
                    <span class="ns-brand-mark ns-brand-mark-lg" aria-hidden="true"></span>
                    <span class="ns-brand-text ns-brand-text-lg">
                        Sanad Smart Inventory System
                        <span class="ns-brand-sub">AI-powered inventory, assets &amp; inspection</span>
                    </span>
                </a>
            </div>

            <!-- BEGIN: Content -->
            @yield('content')
            <!-- END: Content -->
        </div>
    </div>

    <!-- Libs JS -->
    <script src="{{ asset('dist/js/tabler.min.js') }}" defer></script>

    <!-- Custom JS for specific page.  -->
    @stack('page-scripts')
</body>
</html>

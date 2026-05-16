@extends('layouts.tabler')

@section('content')
    <div class="page-header d-print-none">
        <div class="container-xl">
            <div class="row g-2 align-items-center">
                <div class="col">
                    <div class="page-pretitle">
                        Operations · Overview
                    </div>
                    <h2 class="page-title">
                        Dashboard
                    </h2>
                </div>
                <!-- Page title actions -->
                <div class="col-auto ms-auto d-print-none">
                    <div class="d-flex gap-2">
                        <a href="{{ route('lab-assets.create') }}" class="btn btn-primary d-none d-sm-inline-block">
                            <x-icon.plus/>
                            Add Lab Asset
                        </a>
                        <a href="{{ route('lab-assets.create') }}" class="btn btn-primary d-sm-none btn-icon" aria-label="Add Lab Asset">
                            <x-icon.plus/>
                        </a>
                        <a href="{{ route('lab-assets.scan') }}" class="btn btn-primary d-none d-sm-inline-block">
                            <x-icon.plus/>
                            Start Photo Scan
                        </a>
                        <a href="{{ route('lab-assets.scan') }}" class="btn btn-primary d-sm-none btn-icon" aria-label="Start Photo Scan">
                            <x-icon.plus/>
                        </a>
                        <a href="{{ route('purchases.create') }}" class="btn btn-primary d-none d-sm-inline-block">
                            <x-icon.plus/>
                            New Purchase
                        </a>
                        <a href="{{ route('purchases.create') }}" class="btn btn-primary d-sm-none btn-icon" aria-label="New Purchase">
                            <x-icon.plus/>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="page-body">
        <div class="container-xl">
            <div class="row row-deck row-cards">

                <div class="col-12">
                    <div class="row row-cards">
                        {{-- Row 1 — Needs attention --}}
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('purchases.index') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-orange text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 8l0 4l2 2"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $pendingPurchases }} Pending Purchases
                                            </div>
                                            <div class="text-muted">
                                                Awaiting approval
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('orders.pending') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-yellow text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12v9"/><path d="M12 12l-8 -4.5"/><path d="M15 18h7"/><path d="M19 15l3 3l-3 3"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $pendingOrders }} Pending Distributions
                                            </div>
                                            <div class="text-muted">
                                                {{ $orders }} total / {{ $completedOrders }} {{ __('completed') }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('lab-assets.index') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-red text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $labAssetsMaintenanceDue }} Maintenance Due
                                            </div>
                                            <div class="text-muted">
                                                Within 7 days
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('lab-assets.dashboard') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-pink text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v2m0 4v.01"/><path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $missingComponents }} Missing Components
                                            </div>
                                            <div class="text-muted">
                                                Across lab assets
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>

                        {{-- Row 2 — Inventory pulse --}}
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('lab-assets.index') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-primary text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $labAssetsActive }} Active Lab Assets
                                            </div>
                                            <div class="text-muted">
                                                In service
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('products.index') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-green text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-packages" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 16.5l-5 -3l5 -3l5 3v5.5l-5 3z"/><path d="M2 13.5v5.5l5 3"/><path d="M7 16.545l5 -3.03"/><path d="M17 16.5l-5 -3l5 -3l5 3v5.5l-5 3z"/><path d="M12 19l5 3"/><path d="M17 16.5l5 -3"/><path d="M12 13.5v-5.5l-5 -3l5 -3l5 3v5.5"/><path d="M7 5.03v5.455"/><path d="M12 8l5 -3"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $products }} Products
                                            </div>
                                            <div class="text-muted">
                                                {{ $lowStockProducts }} low stock · {{ $categories }} categories
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('lab-assets.scan') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-cyan text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $recentScans }} Recent Scans
                                            </div>
                                            <div class="text-muted">
                                                Last 24 hours
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                        <div class="col-sm-6 col-lg-3">
                            <a href="{{ route('quotations.index') }}" class="text-decoration-none">
                            <div class="card card-sm">
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="col-auto">
                                            <span class="bg-facebook text-white avatar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-files" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 3v4a1 1 0 0 0 1 1h4"/><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z"/><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"/></svg>
                                            </span>
                                        </div>
                                        <div class="col">
                                            <div class="font-weight-medium">
                                                {{ $quotations }} Quotations
                                            </div>
                                            <div class="text-muted">
                                                {{ $todayQuotations }} today
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </a>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    </div>
@endsection


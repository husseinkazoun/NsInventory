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
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="page-body">
        <div class="container-xl">

            {{-- ─── Needs Attention ─────────────────────────────────────── --}}
            <div class="page-section-title">Needs Attention</div>
            <div class="row row-deck row-cards">
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('purchases.index') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-yellow-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 8l0 4l2 2"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $pendingPurchases }}</div>
                                        <div class="ns-stat-label">Pending Purchases</div>
                                        <div class="ns-stat-sub">Awaiting approval</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('orders.pending') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-yellow-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12v9"/><path d="M12 12l-8 -4.5"/><path d="M15 18h7"/><path d="M19 15l3 3l-3 3"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $pendingOrders }}</div>
                                        <div class="ns-stat-label">Pending Orders</div>
                                        <div class="ns-stat-sub">{{ $orders }} total · {{ $completedOrders }} {{ __('completed') }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('lab-assets.index') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-red-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $labAssetsMaintenanceDue }}</div>
                                        <div class="ns-stat-label">Maintenance Due</div>
                                        <div class="ns-stat-sub">Within 7 days</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('lab-assets.dashboard') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-red-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v2m0 4v.01"/><path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $missingComponents }}</div>
                                        <div class="ns-stat-label">Missing Components</div>
                                        <div class="ns-stat-sub">Across lab assets</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            </div>

            {{-- ─── Inventory Pulse ─────────────────────────────────────── --}}
            <div class="page-section-title">Inventory Pulse</div>
            <div class="row row-deck row-cards">
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('lab-assets.index') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-blue-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $labAssetsActive }}</div>
                                        <div class="ns-stat-label">Active Lab Assets</div>
                                        <div class="ns-stat-sub">In service</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('products.index') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-blue-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-packages" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 16.5l-5 -3l5 -3l5 3v5.5l-5 3z"/><path d="M2 13.5v5.5l5 3"/><path d="M7 16.545l5 -3.03"/><path d="M17 16.5l-5 -3l5 -3l5 3v5.5l-5 3z"/><path d="M12 19l5 3"/><path d="M17 16.5l5 -3"/><path d="M12 13.5v-5.5l-5 -3l5 -3l5 3v5.5"/><path d="M7 5.03v5.455"/><path d="M12 8l5 -3"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $products }}</div>
                                        <div class="ns-stat-label">Products</div>
                                        <div class="ns-stat-sub">{{ $lowStockProducts }} low stock · {{ $categories }} categories</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('lab-assets.scan') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-blue-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $recentScans }}</div>
                                        <div class="ns-stat-label">Recent Scans</div>
                                        <div class="ns-stat-sub">Last 24 hours</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-sm-6 col-xl-3">
                    <a href="{{ route('quotations.index') }}" class="text-decoration-none">
                        <div class="card card-sm">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-3">
                                    <span class="bg-blue-lt avatar flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-files" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 3v4a1 1 0 0 0 1 1h4"/><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z"/><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"/></svg>
                                    </span>
                                    <div class="flex-fill min-w-0">
                                        <div class="ns-stat-value">{{ $quotations }}</div>
                                        <div class="ns-stat-label">Quotations</div>
                                        <div class="ns-stat-sub">{{ $todayQuotations }} today</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            </div>

            {{-- ─── Quick Actions ───────────────────────────────────────── --}}
            <div class="page-section-title">Quick Actions</div>
            <div class="row row-deck row-cards">
                <div class="col-12 col-md-6">
                    <a href="{{ route('lab-assets.scan') }}" class="card ns-quick-action">
                        <div class="card-body">
                            <div class="d-flex align-items-center gap-3">
                                <span class="bg-blue-lt avatar flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>
                                </span>
                                <div class="flex-fill min-w-0">
                                    <div class="ns-stat-label">Start Photo Scan</div>
                                    <div class="ns-stat-sub">Intake or inspect a lab asset by photo</div>
                                </div>
                                <svg class="ns-chevron flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6"/></svg>
                            </div>
                        </div>
                    </a>
                </div>
                <div class="col-12 col-md-6">
                    <a href="{{ route('purchases.create') }}" class="card ns-quick-action">
                        <div class="card-body">
                            <div class="d-flex align-items-center gap-3">
                                <span class="bg-blue-lt avatar flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-package-import" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12v9"/><path d="M12 12l-8 -4.5"/><path d="M22 18h-7"/><path d="M18 15l-3 3l3 3"/></svg>
                                </span>
                                <div class="flex-fill min-w-0">
                                    <div class="ns-stat-label">New Purchase</div>
                                    <div class="ns-stat-sub">Record a procurement order</div>
                                </div>
                                <svg class="ns-chevron flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6"/></svg>
                            </div>
                        </div>
                    </a>
                </div>
            </div>

        </div>
    </div>
@endsection


@extends('layouts.tabler')

@php
    $conditionBadge = [
        'excellent' => 'success',
        'good'      => 'primary',
        'fair'      => 'warning',
        'poor'      => 'danger',
        'broken'    => 'dark',
    ][$labAsset->condition_status] ?? 'secondary';

    $statusBadge = [
        'active'      => 'success',
        'inactive'    => 'secondary',
        'maintenance' => 'warning',
        'disposed'    => 'danger',
    ][$labAsset->asset_status] ?? 'secondary';

    $componentStatusBadge = [
        'missing'   => 'danger',
        'ordered'   => 'warning',
        'received'  => 'info',
        'installed' => 'success',
    ];
@endphp

@section('content')
<div class="page-header d-print-none">
    <div class="container-xl">
        <div class="row g-2 align-items-center mb-3">
            <div class="col">
                <div class="page-pretitle">Lab Assets · {{ $labAsset->code }}</div>
                <h2 class="page-title">{{ $labAsset->name }}</h2>
                <div class="mt-1">
                    <span class="badge bg-{{ $statusBadge }}-lt">{{ ucfirst($labAsset->asset_status) }}</span>
                    <span class="badge bg-{{ $conditionBadge }}-lt">{{ ucfirst($labAsset->condition_status) }}</span>
                    @if($labAsset->isWarrantyExpiring())
                        <span class="badge bg-danger-lt">Warranty expiring</span>
                    @endif
                    @if($labAsset->needsMaintenance())
                        <span class="badge bg-warning-lt">Maintenance due</span>
                    @endif
                </div>
            </div>
            <div class="col-auto ms-auto">
                <div class="btn-list">
                    <x-button.edit route="{{ route('lab-assets.edit', $labAsset) }}">
                        {{ __('Edit') }}
                    </x-button.edit>

                    <x-button.delete
                        route="{{ route('lab-assets.destroy', $labAsset) }}"
                        onclick="return confirm('Delete this lab asset? This cannot be undone.')"
                    >
                        {{ __('Delete') }}
                    </x-button.delete>

                    <x-button.back route="{{ route('lab-assets.index') }}">
                        {{ __('Back') }}
                    </x-button.back>
                </div>
            </div>
        </div>

        @include('partials._breadcrumbs', ['model' => $labAsset])
    </div>
</div>

<div class="page-body">
    <div class="container-xl">
        <x-alert/>

        <div class="row row-cards">
            <div class="col-lg-4">
                <div class="card">
                    <div class="card-body text-center">
                        <img
                            class="img-account-profile mb-2"
                            src="{{ $labAsset->product_image ? \Illuminate\Support\Facades\Storage::url($labAsset->product_image) : asset('assets/img/products/default.webp') }}"
                            alt="{{ $labAsset->name }}"
                            style="max-height: 240px; object-fit: contain;"
                        />
                    </div>
                </div>

                <div class="card mt-3">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Identification') }}</h3>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Code</span><span>{{ $labAsset->code }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Serial</span><span>{{ $labAsset->serial_number ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Asset Tag</span><span>{{ $labAsset->asset_tag ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Manufacturer</span><span>{{ $labAsset->manufacturer ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Model</span><span>{{ $labAsset->model ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Part Number</span><span>{{ $labAsset->part_number ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Category</span>
                            <span>
                                @if($labAsset->category)
                                    <a href="{{ route('categories.show', $labAsset->category) }}" class="badge bg-blue-lt">
                                        {{ $labAsset->category->name }}
                                    </a>
                                @else — @endif
                            </span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Unit</span>
                            <span>{{ $labAsset->unit?->name ?: '—' }}</span>
                        </li>
                    </ul>
                </div>

                <div class="card mt-3">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Location & Assignment') }}</h3>
                    </div>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Location</span><span>{{ $labAsset->location ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Room</span><span>{{ $labAsset->room ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Department</span><span>{{ $labAsset->department ?: '—' }}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between">
                            <span class="text-muted">Assigned To</span>
                            <span>
                                @if($labAsset->assignedUser)
                                    {{ $labAsset->assignedUser->name }}
                                @else
                                    <span class="text-muted">Unassigned</span>
                                @endif
                            </span>
                        </li>
                        @if($labAsset->assignment_date)
                            <li class="list-group-item d-flex justify-content-between">
                                <span class="text-muted">Assigned Since</span>
                                <span>{{ $labAsset->assignment_date->format('M j, Y') }}</span>
                            </li>
                        @endif
                    </ul>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Maintenance & Warranty') }}</h3>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <div class="text-muted small">Last Maintenance</div>
                                <div class="h3 mb-0">
                                    {{ $labAsset->last_maintenance?->format('M j, Y') ?: '—' }}
                                </div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <div class="text-muted small">Next Maintenance</div>
                                <div class="h3 mb-0 {{ $labAsset->needsMaintenance() ? 'text-warning' : '' }}">
                                    {{ $labAsset->next_maintenance?->format('M j, Y') ?: '—' }}
                                </div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <div class="text-muted small">Warranty Expiry</div>
                                <div class="h3 mb-0 {{ $labAsset->isWarrantyExpiring() ? 'text-danger' : '' }}">
                                    {{ $labAsset->warranty_expiry?->format('M j, Y') ?: '—' }}
                                </div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <div class="text-muted small">Buying Price</div>
                                <div class="h3 mb-0">
                                    @if(is_numeric($labAsset->buying_price))
                                        {{ number_format($labAsset->buying_price, 2) }}
                                    @else — @endif
                                </div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <div class="text-muted small">Scan Confidence</div>
                                <div class="h3 mb-0">
                                    {{ $labAsset->scan_confidence !== null ? number_format($labAsset->scan_confidence * 100) . '%' : '—' }}
                                </div>
                            </div>
                            <div class="col-md-4 mb-3">
                                <div class="text-muted small">Last Scanned</div>
                                <div class="h3 mb-0">
                                    {{ $labAsset->last_scanned?->diffForHumans() ?: '—' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                @if($labAsset->notes)
                <div class="card mt-3">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Notes') }}</h3>
                    </div>
                    <div class="card-body">
                        <p class="mb-0" style="white-space: pre-line;">{{ $labAsset->notes }}</p>
                    </div>
                </div>
                @endif

                @if($labAsset->specifications)
                <div class="card mt-3">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Specifications') }}</h3>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-vcenter card-table">
                            <tbody>
                                @foreach($labAsset->specifications as $key => $value)
                                    <tr>
                                        <td class="text-muted" style="width: 30%;">{{ $key }}</td>
                                        <td>{{ is_scalar($value) ? $value : json_encode($value) }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
                @endif

                <div class="card mt-3">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Missing Components') }}</h3>
                        <div class="card-actions text-muted small">
                            {{ $labAsset->missingComponents->count() }} total
                        </div>
                    </div>
                    @if($labAsset->missingComponents->count() > 0)
                        <div class="table-responsive">
                            <table class="table table-vcenter card-table">
                                <thead>
                                    <tr>
                                        <th>Component</th>
                                        <th>Required</th>
                                        <th>Detected</th>
                                        <th>Status</th>
                                        <th>Resolved By</th>
                                        <th>Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($labAsset->missingComponents as $component)
                                        <tr>
                                            <td>
                                                <div>{{ $component->component_name }}</div>
                                                <div class="text-muted small">{{ $component->component_type }}</div>
                                            </td>
                                            <td>
                                                @if($component->required)
                                                    <span class="badge bg-danger-lt">Required</span>
                                                @else
                                                    <span class="badge bg-secondary-lt">Optional</span>
                                                @endif
                                            </td>
                                            <td>
                                                <span class="badge bg-{{ $component->detected_by === 'scan' ? 'primary' : 'secondary' }}-lt">
                                                    {{ ucfirst($component->detected_by) }}
                                                </span>
                                                @if($component->detection_confidence)
                                                    <div class="text-muted small">
                                                        {{ number_format($component->detection_confidence * 100) }}%
                                                    </div>
                                                @endif
                                            </td>
                                            <td>
                                                <span class="badge bg-{{ $componentStatusBadge[$component->status] ?? 'secondary' }}-lt">
                                                    {{ ucfirst($component->status) }}
                                                </span>
                                            </td>
                                            <td>{{ $component->resolvedBy?->name ?: '—' }}</td>
                                            <td>{{ $component->estimated_cost ? number_format($component->estimated_cost, 2) : '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @else
                        <div class="card-body text-muted text-center">
                            No missing components recorded.
                        </div>
                    @endif
                </div>

                <div class="card mt-3">
                    <div class="card-header">
                        <h3 class="card-title">{{ __('Recent Scans') }}</h3>
                        <div class="card-actions">
                            <a href="{{ route('lab-assets.scan') }}" class="btn btn-sm btn-outline-primary">
                                {{ __('Scan again') }}
                            </a>
                        </div>
                    </div>
                    @if($recentScans->count() > 0)
                        <div class="table-responsive">
                            <table class="table table-vcenter card-table">
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Confidence</th>
                                        <th>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($recentScans as $scan)
                                        <tr>
                                            <td>{{ $scan->created_at?->diffForHumans() }}</td>
                                            <td><span class="badge bg-blue-lt">{{ str_replace('_', ' ', $scan->photo_type) }}</span></td>
                                            <td>
                                                <span class="badge bg-{{ $scan->processing_status === 'completed' ? 'success' : ($scan->processing_status === 'failed' ? 'danger' : 'secondary') }}-lt">
                                                    {{ ucfirst($scan->processing_status) }}
                                                </span>
                                            </td>
                                            <td>
                                                {{ $scan->confidence_score !== null ? number_format($scan->confidence_score * 100) . '%' : '—' }}
                                            </td>
                                            <td>{{ $scan->scanningSession?->user?->name ?: '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @else
                        <div class="card-body text-muted text-center">
                            No scans recorded yet.
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

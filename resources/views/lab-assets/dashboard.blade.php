@extends('layouts.tabler')

@section('content')
<div class="page-body">
    <div class="container-xl">
        <!-- Page title -->
        <div class="page-header d-print-none">
            <div class="row g-2 align-items-center">
                <div class="col">
                    <div class="page-pretitle">
                        Lab Assets
                    </div>
                    <h2 class="page-title">
                        Dashboard
                    </h2>
                </div>
                <div class="col-12 col-md-auto ms-auto d-print-none">
                    <div class="btn-list">
                        <a href="{{ route('lab-assets.scan') }}" class="btn btn-primary d-none d-sm-inline-block">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <circle cx="12" cy="13" r="3"/>
                                <path d="m12 1 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
                            </svg>
                            Scan Assets
                        </a>
                        <a href="{{ route('lab-assets.create') }}" class="btn btn-success d-none d-sm-inline-block">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Add Asset
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Statistics Cards -->
        <div class="row row-deck row-cards mb-3">
            <div class="col-sm-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="subheader">Total Assets</div>
                        </div>
                        <div class="h1 mb-3">{{ $stats['total_assets'] }}</div>
                        <div class="d-flex mb-2">
                            <div class="flex-fill">
                                <div class="progress progress-sm">
                                    <div class="progress-bar bg-primary" style="width: 100%" role="progressbar"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="subheader">Active Assets</div>
                        </div>
                        <div class="h1 mb-3">{{ $stats['active_assets'] }}</div>
                        <div class="d-flex mb-2">
                            <div class="flex-fill">
                                <div class="progress progress-sm">
                                    <div class="progress-bar bg-success" style="width: {{ $stats['total_assets'] > 0 ? ($stats['active_assets'] / $stats['total_assets']) * 100 : 0 }}%" role="progressbar"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="subheader">Assigned Assets</div>
                        </div>
                        <div class="h1 mb-3">{{ $stats['assigned_assets'] }}</div>
                        <div class="d-flex mb-2">
                            <div class="flex-fill">
                                <div class="progress progress-sm">
                                    <div class="progress-bar bg-info" style="width: {{ $stats['total_assets'] > 0 ? ($stats['assigned_assets'] / $stats['total_assets']) * 100 : 0 }}%" role="progressbar"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="subheader">Missing Components</div>
                        </div>
                        <div class="h1 mb-3 {{ $stats['missing_components'] > 0 ? 'text-danger' : 'text-success' }}">{{ $stats['missing_components'] }}</div>
                        <div class="d-flex mb-2">
                            <div class="flex-fill">
                                <div class="progress progress-sm">
                                    <div class="progress-bar {{ $stats['missing_components'] > 0 ? 'bg-danger' : 'bg-success' }}" style="width: {{ $stats['missing_components'] > 0 ? 100 : 0 }}%" role="progressbar"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alert Cards -->
        @if($stats['maintenance_due'] > 0 || $stats['warranty_expiring'] > 0)
        <div class="row row-deck row-cards mb-3">
            @if($stats['maintenance_due'] > 0)
            <div class="col-md-6">
                <div class="card card-sm">
                    <div class="card-status-top bg-warning"></div>
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-warning text-white avatar">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9s-9-1.8-9-9s1.8-9 9-9z"/>
                                        <path d="M12 8v4"/>
                                        <path d="M12 16h.01"/>
                                    </svg>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">
                                    {{ $stats['maintenance_due'] }} assets need maintenance
                                </div>
                                <div class="text-muted">
                                    Due within 7 days
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            @endif
            @if($stats['warranty_expiring'] > 0)
            <div class="col-md-6">
                <div class="card card-sm">
                    <div class="card-status-top bg-danger"></div>
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-danger text-white avatar">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <circle cx="12" cy="12" r="9"/>
                                        <polyline points="12,7 12,12 15,15"/>
                                    </svg>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">
                                    {{ $stats['warranty_expiring'] }} warranties expiring
                                </div>
                                <div class="text-muted">
                                    Within 30 days
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            @endif
        </div>
        @endif

        <!-- Content Row -->
        <div class="row row-deck row-cards">
            <!-- Recent Assets -->
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Recent Assets</h3>
                        <div class="card-actions">
                            <a href="{{ route('lab-assets.index') }}" class="btn btn-sm btn-outline-primary">
                                View all
                            </a>
                        </div>
                    </div>
                    <div class="card-body p-0">
                        @if($recentAssets->count() > 0)
                        <div class="list-group list-group-flush">
                            @foreach($recentAssets as $asset)
                            <div class="list-group-item">
                                <div class="row align-items-center">
                                    <div class="col-auto">
                                        @if($asset->product_image)
                                        <img src="{{ Storage::url($asset->product_image) }}" alt="{{ $asset->name }}" class="avatar">
                                        @else
                                        <span class="avatar bg-secondary text-white">
                                            {{ strtoupper(substr($asset->name, 0, 2)) }}
                                        </span>
                                        @endif
                                    </div>
                                    <div class="col text-truncate">
                                        <a href="{{ route('lab-assets.show', $asset) }}" class="text-reset d-block">{{ $asset->name }}</a>
                                        <div class="d-block text-muted text-truncate mt-n1">
                                            {{ $asset->serial_number ?? 'No serial number' }}
                                            @if($asset->assignedUser)
                                            • Assigned to {{ $asset->assignedUser->name }}
                                            @endif
                                        </div>
                                    </div>
                                    <div class="col-auto">
                                        <span class="badge bg-{{ $asset->condition_status === 'excellent' ? 'success' : ($asset->condition_status === 'good' ? 'primary' : ($asset->condition_status === 'fair' ? 'warning' : 'danger')) }}">
                                            {{ ucfirst($asset->condition_status) }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            @endforeach
                        </div>
                        @else
                        <div class="empty">
                            <div class="empty-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                                    <path d="M9 9h6v6h-6z"/>
                                </svg>
                            </div>
                            <p class="empty-title">No assets found</p>
                            <p class="empty-subtitle text-muted">
                                Get started by adding your first lab asset or scanning equipment.
                            </p>
                            <div class="empty-action">
                                <a href="{{ route('lab-assets.create') }}" class="btn btn-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Add your first asset
                                </a>
                            </div>
                        </div>
                        @endif
                    </div>
                </div>
            </div>

            <!-- Maintenance Due -->
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Maintenance Due</h3>
                    </div>
                    <div class="card-body p-0">
                        @if($maintenanceDue->count() > 0)
                        <div class="list-group list-group-flush">
                            @foreach($maintenanceDue as $asset)
                            <div class="list-group-item">
                                <div class="row align-items-center">
                                    <div class="col text-truncate">
                                        <a href="{{ route('lab-assets.show', $asset) }}" class="text-reset d-block">{{ $asset->name }}</a>
                                        <div class="d-block text-muted text-truncate mt-n1">
                                            Due: {{ $asset->next_maintenance->format('M j, Y') }}
                                            @if($asset->assignedUser)
                                            • {{ $asset->assignedUser->name }}
                                            @endif
                                        </div>
                                    </div>
                                    <div class="col-auto">
                                        @php
                                            $daysUntil = now()->diffInDays($asset->next_maintenance, false);
                                        @endphp
                                        <span class="badge bg-{{ $daysUntil < 0 ? 'danger' : ($daysUntil <= 3 ? 'warning' : 'info') }}">
                                            @if($daysUntil < 0)
                                                {{ abs($daysUntil) }} days overdue
                                            @elseif($daysUntil == 0)
                                                Today
                                            @else
                                                {{ $daysUntil }} days
                                            @endif
                                        </span>
                                    </div>
                                </div>
                            </div>
                            @endforeach
                        </div>
                        @else
                        <div class="empty">
                            <div class="empty-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon text-success" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                    <path d="M5 12l5 5l10 -10"/>
                                </svg>
                            </div>
                            <p class="empty-title">All caught up!</p>
                            <p class="empty-subtitle text-muted">
                                No maintenance is due in the next 7 days.
                            </p>
                        </div>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Missing Components -->
        @if($missingComponents->count() > 0)
        <div class="row row-deck row-cards mt-3">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Missing Components</h3>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-vcenter card-table">
                                <thead>
                                    <tr>
                                        <th>Asset</th>
                                        <th>Component</th>
                                        <th>Required</th>
                                        <th>Detected</th>
                                        <th>Status</th>
                                        <th class="w-1"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($missingComponents as $component)
                                    <tr>
                                        <td>
                                            <a href="{{ route('lab-assets.show', $component->product) }}" class="text-reset">
                                                {{ $component->product->name }}
                                            </a>
                                        </td>
                                        <td>{{ $component->component_name }}</td>
                                        <td>
                                            @if($component->required)
                                            <span class="badge bg-danger">Required</span>
                                            @else
                                            <span class="badge bg-secondary">Optional</span>
                                            @endif
                                        </td>
                                        <td>
                                            <span class="badge bg-{{ $component->detected_by === 'scan' ? 'primary' : 'secondary' }}">
                                                {{ ucfirst($component->detected_by) }}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge bg-{{ $component->status === 'missing' ? 'danger' : ($component->status === 'ordered' ? 'warning' : 'success') }}">
                                                {{ ucfirst($component->status) }}
                                            </span>
                                        </td>
                                        <td>
                                            @if($component->estimated_cost)
                                            <span class="text-muted">${{ number_format($component->estimated_cost, 2) }}</span>
                                            @endif
                                        </td>
                                    </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        @endif
    </div>
</div>
@endsection


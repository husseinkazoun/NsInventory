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
                        All Assets
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
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="subheader">Active</div>
                        </div>
                        <div class="h1 mb-3 text-success">{{ $stats['active_assets'] }}</div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="subheader">Assigned</div>
                        </div>
                        <div class="h1 mb-3 text-info">{{ $stats['assigned_assets'] }}</div>
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
                    </div>
                </div>
            </div>
        </div>

        <!-- Assets Table -->
        <div class="row row-deck row-cards">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Lab Assets</h3>
                        <div class="card-actions">
                            <div class="input-group">
                                <input type="text" class="form-control" placeholder="Search assets..." id="search-input">
                                <button class="btn btn-outline-secondary" type="button">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="m21 21-4.35-4.35"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body p-0">
                        @if($labAssets->count() > 0)
                        <div class="table-responsive">
                            <table class="table table-vcenter card-table">
                                <thead>
                                    <tr>
                                        <th>Asset</th>
                                        <th>Serial Number</th>
                                        <th>Location</th>
                                        <th>Assigned To</th>
                                        <th>Condition</th>
                                        <th>Status</th>
                                        <th>Missing Components</th>
                                        <th class="w-1"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($labAssets as $asset)
                                    <tr>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                @if($asset->product_image)
                                                <img src="{{ Storage::url($asset->product_image) }}" alt="{{ $asset->name }}" class="avatar me-3">
                                                @else
                                                <span class="avatar bg-secondary text-white me-3">
                                                    {{ strtoupper(substr($asset->name, 0, 2)) }}
                                                </span>
                                                @endif
                                                <div>
                                                    <div class="font-weight-medium">{{ $asset->name }}</div>
                                                    <div class="text-muted">
                                                        {{ $asset->manufacturer }} {{ $asset->model }}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="text-muted">{{ $asset->serial_number ?: 'N/A' }}</span>
                                        </td>
                                        <td>
                                            @if($asset->location)
                                            <div>{{ $asset->location }}</div>
                                            @if($asset->room)
                                            <div class="text-muted small">{{ $asset->room }}</div>
                                            @endif
                                            @else
                                            <span class="text-muted">Not set</span>
                                            @endif
                                        </td>
                                        <td>
                                            @if($asset->assignedUser)
                                            <div class="d-flex align-items-center">
                                                <span class="avatar avatar-sm bg-primary text-white me-2">
                                                    {{ strtoupper(substr($asset->assignedUser->name, 0, 2)) }}
                                                </span>
                                                <div>
                                                    <div>{{ $asset->assignedUser->name }}</div>
                                                    <div class="text-muted small">{{ $asset->assignment_date?->format('M j, Y') }}</div>
                                                </div>
                                            </div>
                                            @else
                                            <span class="text-muted">Unassigned</span>
                                            @endif
                                        </td>
                                        <td>
                                            <span class="badge bg-{{ $asset->condition_status === 'excellent' ? 'success' : ($asset->condition_status === 'good' ? 'primary' : ($asset->condition_status === 'fair' ? 'warning' : 'danger')) }}">
                                                {{ ucfirst($asset->condition_status) }}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge bg-{{ $asset->asset_status === 'active' ? 'success' : ($asset->asset_status === 'inactive' ? 'secondary' : ($asset->asset_status === 'maintenance' ? 'warning' : 'danger')) }}">
                                                {{ ucfirst($asset->asset_status) }}
                                            </span>
                                        </td>
                                        <td>
                                            @php
                                                $missingCount = $asset->getMissingComponentsCount();
                                            @endphp
                                            @if($missingCount > 0)
                                            <span class="badge bg-danger">{{ $missingCount }}</span>
                                            @else
                                            <span class="text-success">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                    <path d="M5 12l5 5l10 -10"/>
                                                </svg>
                                            </span>
                                            @endif
                                        </td>
                                        <td>
                                            <div class="btn-list flex-nowrap">
                                                <a href="{{ route('lab-assets.show', $asset) }}" class="btn btn-sm btn-outline-primary">
                                                    View
                                                </a>
                                                <div class="dropdown">
                                                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                        Actions
                                                    </button>
                                                    <div class="dropdown-menu">
                                                        <a class="dropdown-item" href="{{ route('lab-assets.edit', $asset) }}">
                                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon dropdown-item-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/>
                                                                <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"/>
                                                                <path d="M16 5l3 3"/>
                                                            </svg>
                                                            Edit
                                                        </a>
                                                        @if($asset->asset_status === 'active')
                                                        <a class="dropdown-item" href="#" onclick="changeStatus('{{ $asset->id }}', 'maintenance')">
                                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon dropdown-item-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9s-9-1.8-9-9s1.8-9 9-9z"/>
                                                                <path d="M12 8v4"/>
                                                                <path d="M12 16h.01"/>
                                                            </svg>
                                                            Mark for Maintenance
                                                        </a>
                                                        @endif
                                                        <div class="dropdown-divider"></div>
                                                        <a class="dropdown-item text-danger" href="#" onclick="deleteAsset('{{ $asset->id }}', '{{ $asset->name }}')">
                                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon dropdown-item-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                <line x1="4" y1="7" x2="20" y2="7"/>
                                                                <line x1="10" y1="11" x2="10" y2="17"/>
                                                                <line x1="14" y1="11" x2="14" y2="17"/>
                                                                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
                                                                <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
                                                            </svg>
                                                            Delete
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    @endforeach
                                </tbody>
                            </table>
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
                            <p class="empty-title">No lab assets found</p>
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
                    @if($labAssets->hasPages())
                    <div class="card-footer d-flex align-items-center">
                        {{ $labAssets->links() }}
                    </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<div class="modal modal-blur fade" id="deleteModal" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-sm modal-dialog-centered" role="document">
        <div class="modal-content">
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            <div class="modal-status bg-danger"></div>
            <div class="modal-body text-center py-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon mb-2 text-danger icon-lg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 9v2m0 4v.01"/>
                    <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"/>
                </svg>
                <h3>Are you sure?</h3>
                <div class="text-muted">Do you really want to delete this asset? This action cannot be undone.</div>
            </div>
            <div class="modal-footer">
                <div class="w-100">
                    <div class="row">
                        <div class="col">
                            <button type="button" class="btn w-100" data-bs-dismiss="modal">Cancel</button>
                        </div>
                        <div class="col">
                            <form id="deleteForm" method="POST" style="display: inline;">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger w-100">Delete</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
function deleteAsset(assetId, assetName) {
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    const form = document.getElementById('deleteForm');
    form.action = `/lab-assets/${assetId}`;
    modal.show();
}

function changeStatus(assetId, status) {
    if (confirm(`Are you sure you want to mark this asset for ${status}?`)) {
        // You can implement status change functionality here
        alert('Status change functionality would be implemented here');
    }
}

// Search functionality
document.getElementById('search-input').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});
</script>
@endsection


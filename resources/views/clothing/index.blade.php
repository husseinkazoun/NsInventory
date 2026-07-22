@extends('layouts.tabler')

@section('content')
<div class="page-header d-print-none">
    <div class="container-xl">
        <div class="row g-2 align-items-center">
            <div class="col">
                <div class="page-pretitle">Second-hand shop pilot</div>
                <h2 class="page-title">Clothing Inventory</h2>
            </div>
            <div class="col-12 col-md-auto ms-auto d-print-none">
                <div class="btn-list">
                    <a href="{{ route('clothing.export') }}" class="btn btn-outline-secondary">
                        Export for Google Sheets
                    </a>
                    <a href="{{ route('clothing.scan') }}" class="btn btn-primary">
                        Scan a garment
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="page-body">
    <div class="container-xl">
        <div class="row row-cards mb-4">
            @foreach ([
                'Total' => $stats['total'],
                'To process' => $stats['to_process'],
                'Ready' => $stats['ready'],
                'Listed' => $stats['listed'],
                'Sold' => $stats['sold'],
            ] as $label => $value)
                <div class="col-6 col-md">
                    <div class="card card-sm">
                        <div class="card-body">
                            <div class="text-secondary">{{ $label }}</div>
                            <div class="h2 mb-0">{{ $value }}</div>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>

        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Garments</h3>
            </div>

            @if ($items->isEmpty())
                <div class="card-body text-center py-5">
                    <h3>No clothing items yet</h3>
                    <p class="text-secondary">Start with a 10-item camera pilot before processing the full inventory.</p>
                    <a href="{{ route('clothing.scan') }}" class="btn btn-primary">Scan the first garment</a>
                </div>
            @else
                <div class="table-responsive">
                    <table class="table table-vcenter card-table">
                        <thead>
                            <tr>
                                <th>Photo</th>
                                <th>Item</th>
                                <th>Details</th>
                                <th>Condition</th>
                                <th>Status</th>
                                <th>Storage</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($items as $item)
                                @php($details = $item->specifications ?? [])
                                <tr>
                                    <td>
                                        @if ($item->product_image)
                                            <img src="{{ asset('storage/products/' . $item->product_image) }}"
                                                 alt="{{ $item->name }}" class="avatar avatar-lg rounded">
                                        @else
                                            <span class="avatar avatar-lg">—</span>
                                        @endif
                                    </td>
                                    <td>
                                        <div class="fw-bold">{{ $item->code }}</div>
                                        <div>{{ $item->name }}</div>
                                    </td>
                                    <td class="text-secondary">
                                        {{ $details['brand'] ?? 'Unknown brand' }}
                                        · {{ $details['size_label'] ?? 'No size' }}
                                        <br>
                                        {{ $details['color'] ?? 'No color' }}
                                        · {{ $details['garment_type'] ?? $item->category?->name }}
                                    </td>
                                    <td>{{ ucfirst($item->condition_status ?? 'good') }}</td>
                                    <td>
                                        <span class="badge bg-blue-lt">
                                            {{ str_replace('_', ' ', ucfirst($details['inventory_status'] ?? 'to_process')) }}
                                        </span>
                                    </td>
                                    <td>{{ $details['storage_location'] ?? 'Not assigned' }}</td>
                                    <td>{{ number_format($item->selling_price ?? 0, 2) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>

                <div class="card-footer">
                    {{ $items->links() }}
                </div>
            @endif
        </div>
    </div>
</div>
@endsection

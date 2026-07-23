@extends('layouts.tabler')

@section('content')
<div class="page-header d-print-none">
    <div class="container-xl">
        <div class="row g-2 align-items-center">
            <div class="col">
                <div class="page-pretitle">Administrators only</div>
                <h2 class="page-title">Trash</h2>
            </div>
            <div class="col-12 col-md-auto ms-auto d-print-none">
                <a href="{{ route('products.index') }}" class="btn">Back to products</a>
            </div>
        </div>
    </div>
</div>

<div class="page-body">
    <div class="container-xl">

        @if (session('success'))
            <div class="alert alert-success" role="alert">{{ session('success') }}</div>
        @endif

        @if ($errors->any())
            <div class="alert alert-danger" role="alert" data-testid="trash-error">
                {{ $errors->first() }}
            </div>
        @endif

        <div class="alert alert-info" role="alert">
            Deleted products are kept here with their images and raw scan photos intact.
            <strong>Restore</strong> puts a product back exactly as it was.
            Permanent deletion cannot be undone and must be confirmed by typing the product code.
        </div>

        <div class="card">
            <div class="table-responsive">
                <table class="table card-table table-vcenter">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Deleted</th>
                            <th class="w-1">Restore</th>
                            <th>Permanently delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($products as $product)
                            <tr data-testid="trashed-product">
                                <td>{{ $product->code }}</td>
                                <td>{{ $product->name }}</td>
                                <td>{{ $product->product_type }}</td>
                                <td>{{ $product->deleted_at?->diffForHumans() }}</td>
                                <td>
                                    <form action="{{ route('products.trash.restore', $product->id) }}" method="POST">
                                        @csrf
                                        @method('PUT')
                                        <button type="submit" class="btn btn-success btn-sm">Restore</button>
                                    </form>
                                </td>
                                <td>
                                    @php($confirmationPhrase = $product->deletionConfirmationPhrase())
                                    <form action="{{ route('products.trash.forceDelete', $product->id) }}" method="POST"
                                          onsubmit="return confirm('Permanently delete {{ $confirmationPhrase }}? This cannot be undone.');">
                                        @csrf
                                        @method('DELETE')
                                        <div class="input-group">
                                            <input type="text" name="confirmation" class="form-control form-control-sm"
                                                   placeholder="Type {{ $confirmationPhrase }}" autocomplete="off" required>
                                            <button type="submit" class="btn btn-danger btn-sm">Delete forever</button>
                                        </div>
                                    </form>
                                    <small class="text-secondary">Type <code>{{ $confirmationPhrase }}</code> to confirm</small>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="text-secondary">Trash is empty — no deleted products.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
@endsection

@extends('layouts.tabler')

@section('content')
<div class="page-header d-print-none">
    <div class="container-xl">
        <div class="row g-2 align-items-center mb-3">
            <div class="col">
                <div class="page-pretitle">Lab Assets</div>
                <h2 class="page-title">{{ __('Add Lab Asset') }}</h2>
            </div>
            <div class="col-auto ms-auto">
                <x-button.back route="{{ route('lab-assets.index') }}">
                    {{ __('Back') }}
                </x-button.back>
            </div>
        </div>

        @include('partials._breadcrumbs')
    </div>
</div>

<div class="page-body">
    <div class="container-xl">
        <x-alert/>

        <form action="{{ route('lab-assets.store') }}" method="POST" enctype="multipart/form-data">
            @csrf

            <div class="row row-cards">
                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title">{{ __('Asset Photo') }}</h3>

                            <img
                                class="img-account-profile mb-2"
                                src="{{ asset('assets/img/products/default.webp') }}"
                                id="image-preview"
                                alt=""
                            />

                            <div class="small font-italic text-muted mb-2">
                                JPG or PNG no larger than 2 MB
                            </div>

                            <input
                                type="file"
                                accept="image/*"
                                id="image"
                                name="product_image"
                                class="form-control @error('product_image') is-invalid @enderror"
                                onchange="previewImage();"
                            >

                            @error('product_image')
                            <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>
                    </div>

                    <div class="card mt-3">
                        <div class="card-header">
                            <h3 class="card-title">{{ __('Tip') }}</h3>
                        </div>
                        <div class="card-body text-muted small">
                            Prefer scanning? Use
                            <a href="{{ route('lab-assets.scan') }}">Photo Scanning</a>
                            to auto-fill serial / model / manufacturer.
                        </div>
                    </div>
                </div>

                <div class="col-lg-8">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">{{ __('Identification') }}</h3>
                        </div>
                        <div class="card-body">
                            <div class="row row-cards">
                                <div class="col-md-12">
                                    <x-input name="name"
                                             id="name"
                                             placeholder="e.g. Dell OptiPlex 7090"
                                             required
                                             value="{{ old('name') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="serial_number"
                                             label="Serial Number"
                                             id="serial_number"
                                             placeholder="Serial number"
                                             value="{{ old('serial_number') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="asset_tag"
                                             label="Asset Tag"
                                             id="asset_tag"
                                             placeholder="Internal tag"
                                             value="{{ old('asset_tag') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="manufacturer"
                                             label="Manufacturer"
                                             id="manufacturer"
                                             placeholder="e.g. Dell"
                                             value="{{ old('manufacturer') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="model"
                                             label="Model"
                                             id="model"
                                             placeholder="e.g. OptiPlex 7090"
                                             value="{{ old('model') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="part_number"
                                             label="Part Number"
                                             id="part_number"
                                             value="{{ old('part_number') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <div class="mb-3">
                                        <label for="category_id" class="form-label required">
                                            {{ __('Category') }}
                                        </label>
                                        <select name="category_id" id="category_id"
                                                class="form-select @error('category_id') is-invalid @enderror"
                                                required
                                        >
                                            <option value="" selected disabled>Select a category</option>
                                            @foreach ($categories as $category)
                                                <option value="{{ $category->id }}" @selected(old('category_id') == $category->id)>
                                                    {{ $category->name }}
                                                </option>
                                            @endforeach
                                        </select>
                                        @error('category_id')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>

                                <div class="col-sm-6">
                                    <div class="mb-3">
                                        <label for="unit_id" class="form-label required">
                                            {{ __('Unit') }}
                                        </label>
                                        <select name="unit_id" id="unit_id"
                                                class="form-select @error('unit_id') is-invalid @enderror"
                                                required
                                        >
                                            <option value="" selected disabled>Select a unit</option>
                                            @foreach ($units as $unit)
                                                <option value="{{ $unit->id }}" @selected(old('unit_id') == $unit->id)>
                                                    {{ $unit->name }}
                                                </option>
                                            @endforeach
                                        </select>
                                        @error('unit_id')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mt-3">
                        <div class="card-header">
                            <h3 class="card-title">{{ __('Location & Assignment') }}</h3>
                        </div>
                        <div class="card-body">
                            <div class="row row-cards">
                                <div class="col-sm-4">
                                    <x-input name="location"
                                             id="location"
                                             placeholder="Building / Site"
                                             value="{{ old('location') }}"
                                    />
                                </div>
                                <div class="col-sm-4">
                                    <x-input name="room"
                                             id="room"
                                             placeholder="Room number"
                                             value="{{ old('room') }}"
                                    />
                                </div>
                                <div class="col-sm-4">
                                    <x-input name="department"
                                             id="department"
                                             value="{{ old('department') }}"
                                    />
                                </div>

                                <div class="col-sm-12">
                                    <div class="mb-3">
                                        <label for="assigned_to" class="form-label">
                                            {{ __('Assigned To') }}
                                        </label>
                                        <select name="assigned_to" id="assigned_to"
                                                class="form-select @error('assigned_to') is-invalid @enderror"
                                        >
                                            <option value="">— Unassigned —</option>
                                            @foreach ($users as $user)
                                                <option value="{{ $user->id }}" @selected(old('assigned_to') == $user->id)>
                                                    {{ $user->name }} ({{ $user->email }})
                                                </option>
                                            @endforeach
                                        </select>
                                        @error('assigned_to')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mt-3">
                        <div class="card-header">
                            <h3 class="card-title">{{ __('Condition & Warranty') }}</h3>
                        </div>
                        <div class="card-body">
                            <div class="row row-cards">
                                <div class="col-sm-6">
                                    <div class="mb-3">
                                        <label for="condition_status" class="form-label required">
                                            {{ __('Condition') }}
                                        </label>
                                        <select name="condition_status" id="condition_status"
                                                class="form-select @error('condition_status') is-invalid @enderror"
                                                required
                                        >
                                            @foreach (['excellent','good','fair','poor','broken'] as $c)
                                                <option value="{{ $c }}" @selected(old('condition_status', 'good') === $c)>
                                                    {{ ucfirst($c) }}
                                                </option>
                                            @endforeach
                                        </select>
                                        @error('condition_status')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>

                                <div class="col-sm-6">
                                    <x-input type="number"
                                             label="Buying Price"
                                             name="buying_price"
                                             id="buying_price"
                                             placeholder="0"
                                             value="{{ old('buying_price') }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input type="date"
                                             label="Warranty Expiry"
                                             name="warranty_expiry"
                                             id="warranty_expiry"
                                             value="{{ old('warranty_expiry') }}"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mt-3">
                        <div class="card-header">
                            <h3 class="card-title">{{ __('Notes') }}</h3>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <textarea name="notes"
                                          id="notes"
                                          rows="4"
                                          class="form-control @error('notes') is-invalid @enderror"
                                          placeholder="Any additional details about this asset"
                                >{{ old('notes') }}</textarea>
                                @error('notes')
                                <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>
                        <div class="card-footer text-end">
                            <x-button.save type="submit">{{ __('Save') }}</x-button.save>
                            <x-button.back route="{{ route('lab-assets.index') }}">
                                {{ __('Cancel') }}
                            </x-button.back>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    </div>
</div>
@endsection

@pushonce('page-scripts')
    <script src="{{ asset('assets/js/img-preview.js') }}"></script>
@endpushonce

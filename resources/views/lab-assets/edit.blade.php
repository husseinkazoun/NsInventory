@extends('layouts.tabler')

@section('content')
<div class="page-header d-print-none">
    <div class="container-xl">
        <div class="row g-2 align-items-center mb-3">
            <div class="col">
                <div class="page-pretitle">Lab Assets</div>
                <h2 class="page-title">{{ __('Edit Lab Asset') }}</h2>
                <div class="text-muted small">{{ $labAsset->code }}</div>
            </div>
            <div class="col-auto ms-auto">
                <a href="{{ route('lab-assets.show', $labAsset) }}" class="btn btn-outline-secondary">
                    {{ __('Cancel') }}
                </a>
            </div>
        </div>

        @include('partials._breadcrumbs', ['model' => $labAsset])
    </div>
</div>

<div class="page-body">
    <div class="container-xl">
        <x-alert/>

        <form action="{{ route('lab-assets.update', $labAsset) }}" method="POST" enctype="multipart/form-data">
            @csrf
            @method('put')

            <div class="row row-cards">
                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title">{{ __('Asset Photo') }}</h3>

                            <img
                                class="img-account-profile mb-2"
                                src="{{ $labAsset->product_image ? \Illuminate\Support\Facades\Storage::url($labAsset->product_image) : asset('assets/img/products/default.webp') }}"
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
                            <h3 class="card-title">{{ __('Asset Info') }}</h3>
                        </div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between">
                                <span class="text-muted">Code</span>
                                <span>{{ $labAsset->code }}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between">
                                <span class="text-muted">Created</span>
                                <span>{{ $labAsset->created_at?->format('M j, Y') }}</span>
                            </li>
                            @if($labAsset->last_scanned)
                                <li class="list-group-item d-flex justify-content-between">
                                    <span class="text-muted">Last Scanned</span>
                                    <span>{{ $labAsset->last_scanned->diffForHumans() }}</span>
                                </li>
                            @endif
                        </ul>
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
                                             required
                                             value="{{ old('name', $labAsset->name) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="serial_number"
                                             label="Serial Number"
                                             id="serial_number"
                                             value="{{ old('serial_number', $labAsset->serial_number) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="asset_tag"
                                             label="Asset Tag"
                                             id="asset_tag"
                                             value="{{ old('asset_tag', $labAsset->asset_tag) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="manufacturer"
                                             label="Manufacturer"
                                             id="manufacturer"
                                             value="{{ old('manufacturer', $labAsset->manufacturer) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="model"
                                             label="Model"
                                             id="model"
                                             value="{{ old('model', $labAsset->model) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input name="part_number"
                                             label="Part Number"
                                             id="part_number"
                                             value="{{ old('part_number', $labAsset->part_number) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <div class="mb-3">
                                        <label for="category_id" class="form-label required">{{ __('Category') }}</label>
                                        <select name="category_id" id="category_id"
                                                class="form-select @error('category_id') is-invalid @enderror"
                                                required
                                        >
                                            <option value="" disabled>Select a category</option>
                                            @foreach ($categories as $category)
                                                <option value="{{ $category->id }}" @selected(old('category_id', $labAsset->category_id) == $category->id)>
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
                                        <label for="unit_id" class="form-label required">{{ __('Unit') }}</label>
                                        <select name="unit_id" id="unit_id"
                                                class="form-select @error('unit_id') is-invalid @enderror"
                                                required
                                        >
                                            <option value="" disabled>Select a unit</option>
                                            @foreach ($units as $unit)
                                                <option value="{{ $unit->id }}" @selected(old('unit_id', $labAsset->unit_id) == $unit->id)>
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
                                             value="{{ old('location', $labAsset->location) }}"
                                    />
                                </div>
                                <div class="col-sm-4">
                                    <x-input name="room"
                                             id="room"
                                             value="{{ old('room', $labAsset->room) }}"
                                    />
                                </div>
                                <div class="col-sm-4">
                                    <x-input name="department"
                                             id="department"
                                             value="{{ old('department', $labAsset->department) }}"
                                    />
                                </div>

                                <div class="col-sm-12">
                                    <div class="mb-3">
                                        <label for="assigned_to" class="form-label">{{ __('Assigned To') }}</label>
                                        <select name="assigned_to" id="assigned_to"
                                                class="form-select @error('assigned_to') is-invalid @enderror"
                                        >
                                            <option value="">— Unassigned —</option>
                                            @foreach ($users as $user)
                                                <option value="{{ $user->id }}" @selected(old('assigned_to', $labAsset->assigned_to) == $user->id)>
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
                            <h3 class="card-title">{{ __('Condition, Status & Maintenance') }}</h3>
                        </div>
                        <div class="card-body">
                            <div class="row row-cards">
                                <div class="col-sm-6">
                                    <div class="mb-3">
                                        <label for="condition_status" class="form-label required">{{ __('Condition') }}</label>
                                        <select name="condition_status" id="condition_status"
                                                class="form-select @error('condition_status') is-invalid @enderror"
                                                required
                                        >
                                            @foreach (['excellent','good','fair','poor','broken'] as $c)
                                                <option value="{{ $c }}" @selected(old('condition_status', $labAsset->condition_status) === $c)>
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
                                    <div class="mb-3">
                                        <label for="asset_status" class="form-label required">{{ __('Asset Status') }}</label>
                                        <select name="asset_status" id="asset_status"
                                                class="form-select @error('asset_status') is-invalid @enderror"
                                                required
                                        >
                                            @foreach (['active','inactive','maintenance','disposed'] as $s)
                                                <option value="{{ $s }}" @selected(old('asset_status', $labAsset->asset_status) === $s)>
                                                    {{ ucfirst($s) }}
                                                </option>
                                            @endforeach
                                        </select>
                                        @error('asset_status')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>

                                <div class="col-sm-6">
                                    <x-input type="number"
                                             label="Buying Price"
                                             name="buying_price"
                                             id="buying_price"
                                             value="{{ old('buying_price', $labAsset->buying_price) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input type="date"
                                             label="Warranty Expiry"
                                             name="warranty_expiry"
                                             id="warranty_expiry"
                                             value="{{ old('warranty_expiry', optional($labAsset->warranty_expiry)->format('Y-m-d')) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input type="date"
                                             label="Last Maintenance"
                                             name="last_maintenance"
                                             id="last_maintenance"
                                             value="{{ old('last_maintenance', optional($labAsset->last_maintenance)->format('Y-m-d')) }}"
                                    />
                                </div>

                                <div class="col-sm-6">
                                    <x-input type="date"
                                             label="Next Maintenance"
                                             name="next_maintenance"
                                             id="next_maintenance"
                                             value="{{ old('next_maintenance', optional($labAsset->next_maintenance)->format('Y-m-d')) }}"
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
                                >{{ old('notes', $labAsset->notes) }}</textarea>
                                @error('notes')
                                <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>
                        </div>
                        <div class="card-footer text-end">
                            <x-button.save type="submit">{{ __('Update') }}</x-button.save>
                            <x-button.back route="{{ route('lab-assets.show', $labAsset) }}">
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

@extends('layouts.tabler')

@section('content')
@php
    $photoSteps = [
        1 => ['title' => 'Front', 'help' => 'Photograph the full front of the garment.', 'type' => 'overview'],
        2 => ['title' => 'Back', 'help' => 'Photograph the full back of the garment.', 'type' => 'components'],
        3 => ['title' => 'Labels', 'help' => 'Photograph the brand, size, material, and care labels.', 'type' => 'serial_label'],
        4 => ['title' => 'Detail or flaw (optional)', 'help' => 'Optional: photograph an important detail or visible flaw, or skip this step.', 'type' => 'condition'],
    ];
@endphp

<div class="page-header d-print-none">
    <div class="container-xl">
        <div class="row g-2 align-items-center">
            <div class="col">
                <div class="page-pretitle">Clothing inventory</div>
                <h2 class="page-title">Scan a garment</h2>
            </div>
            <div class="col-12 col-md-auto ms-auto">
                <a href="{{ route('clothing.index') }}" class="btn btn-outline-secondary">Back to inventory</a>
            </div>
        </div>
    </div>
</div>

<div class="page-body">
    <div class="container-xl clothing-scanner">
        <div id="scan-alert" class="alert alert-danger" style="display:none"></div>

        <div class="card mb-3">
            <div class="card-body py-3">
                <div class="d-flex flex-wrap gap-2 justify-content-between">
                    @foreach ($photoSteps as $number => $photoStep)
                        <span class="scan-progress" id="progress-{{ $number }}">
                            <span class="scan-progress-number">{{ $number }}</span>
                            {{ $photoStep['title'] }}
                        </span>
                    @endforeach
                    <span class="scan-progress" id="progress-5">
                        <span class="scan-progress-number">5</span>
                        Review
                    </span>
                </div>
            </div>
        </div>

        @foreach ($photoSteps as $number => $photoStep)
            <section class="scan-step" id="scan-step-{{ $number }}" @if($number !== 1) style="display:none" @endif>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">{{ $photoStep['title'] }} photo</h3>
                            <div class="card-subtitle">{{ $photoStep['help'] }}</div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-4">
                            <div class="col-lg-7">
                                <div class="camera-shell" id="camera-shell-{{ $number }}">
                                    <video id="camera-{{ $number }}" autoplay playsinline muted></video>
                                    <canvas id="canvas-{{ $number }}" hidden></canvas>
                                    <div class="camera-guide">Keep the entire subject inside the frame</div>
                                </div>
                                <div class="photo-preview" id="photo-preview-{{ $number }}" style="display:none">
                                    <img id="preview-image-{{ $number }}" alt="{{ $photoStep['title'] }} preview">
                                </div>
                            </div>
                            <div class="col-lg-5">
                                <div class="capture-actions" id="capture-actions-{{ $number }}">
                                    <button type="button" class="btn btn-primary btn-lg w-100 mb-2" data-capture="{{ $number }}">
                                        Take photo
                                    </button>
                                    <label class="btn btn-outline-secondary w-100">
                                        Choose from phone photos or files
                                        <input type="file" id="file-{{ $number }}" accept="image/*" hidden>
                                    </label>
                                </div>
                                <div id="confirm-actions-{{ $number }}" style="display:none">
                                    <button type="button" class="btn btn-success btn-lg w-100 mb-2" data-confirm="{{ $number }}">
                                        Use this photo
                                    </button>
                                    <button type="button" class="btn btn-outline-secondary w-100" data-retake="{{ $number }}">
                                        Retake
                                    </button>
                                </div>
                                @if ($number === 4)
                                    <button type="button" class="btn btn-link w-100 mt-2" data-skip="{{ $number }}">
                                        Skip this optional photo
                                    </button>
                                @endif
                                <div class="alert alert-info mt-3 mb-0">
                                    <strong>Photo tip:</strong>
                                    @if ($number <= 2)
                                        use a plain background and even daylight.
                                    @elseif ($number === 3)
                                        fill the frame with the label and check that the text is sharp.
                                    @else
                                        show the flaw clearly; use this photo for a detail when there is no flaw.
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer" id="uploading-{{ $number }}" style="display:none">
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        Uploading and reading the photo…
                    </div>
                </div>
            </section>
        @endforeach

        <section class="scan-step" id="scan-step-5" style="display:none">
            <div class="card mb-3" id="processing-card">
                <div class="card-body text-center py-5">
                    <span class="spinner-border text-primary mb-3"></span>
                    <h3>Preparing suggestions</h3>
                    <p class="text-secondary mb-0">The photos are being combined into one editable garment record.</p>
                </div>
            </div>

            <form class="card" id="clothing-review" style="display:none">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Review before saving</h3>
                        <div class="card-subtitle">AI suggestions are a starting point. Correct anything that is uncertain.</div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="alert alert-warning">
                        Measurements, hidden damage, odors, authenticity, and final condition require your confirmation.
                    </div>

                    <div class="row g-3">
                        <div class="col-12">
                            <label class="form-label required" for="name">Listing title</label>
                            <input class="form-control" id="name" maxlength="255" required placeholder="Example: Levi's blue denim jacket">
                        </div>

                        <div class="col-md-4">
                            <label class="form-label required" for="category">Category</label>
                            <select class="form-select" id="category" required>
                                <option value="">Select category</option>
                                @foreach ($categories as $category)
                                    <option value="{{ $category->id }}">{{ $category->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label required" for="unit">Unit</label>
                            <select class="form-select" id="unit" required>
                                <option value="">Select unit</option>
                                @foreach ($units as $unit)
                                    <option value="{{ $unit->id }}">{{ $unit->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="department">Department</label>
                            <select class="form-select" id="department">
                                <option value="">Not specified</option>
                                <option value="women">Women</option>
                                <option value="men">Men</option>
                                <option value="unisex">Unisex</option>
                                <option value="kids">Kids</option>
                            </select>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label" for="garment-type">Garment type</label>
                            <input class="form-control" id="garment-type" maxlength="100" placeholder="Jacket, dress, trousers…">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="brand">Brand</label>
                            <input class="form-control" id="brand" maxlength="100">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="size-label">Tagged size</label>
                            <input class="form-control" id="size-label" maxlength="50">
                        </div>

                        <div class="col-md-4">
                            <label class="form-label" for="color">Color</label>
                            <input class="form-control" id="color" maxlength="100">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="pattern">Pattern</label>
                            <input class="form-control" id="pattern" maxlength="100" placeholder="Solid, striped, floral…">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="material">Material shown on label</label>
                            <input class="form-control" id="material" maxlength="255">
                        </div>

                        <div class="col-md-4">
                            <label class="form-label required" for="condition">Condition</label>
                            <select class="form-select" id="condition" required>
                                <option value="excellent">Excellent</option>
                                <option value="good" selected>Good</option>
                                <option value="fair">Fair</option>
                                <option value="poor">Poor</option>
                                <option value="broken">Broken / unusable</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label required" for="inventory-status">Inventory status</label>
                            <select class="form-select" id="inventory-status" required>
                                <option value="to_process" selected>To process</option>
                                <option value="ready">Ready</option>
                                <option value="listed">Listed</option>
                                <option value="reserved">Reserved</option>
                                <option value="sold">Sold</option>
                                <option value="donated">Donated</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="storage-location">Storage location</label>
                            <input class="form-control" id="storage-location" maxlength="100" placeholder="Box A1">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="style-details">Style details</label>
                            <input class="form-control" id="style-details" placeholder="Comma-separated details">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="visible-flaws">Visible flaws</label>
                            <input class="form-control" id="visible-flaws" placeholder="Comma-separated flaws">
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="condition-notes">Condition notes</label>
                            <textarea class="form-control" id="condition-notes" rows="2" maxlength="1000"></textarea>
                        </div>
                    </div>

                    <hr class="my-4">
                    <h4>Measurements in centimeters</h4>
                    <div class="row g-3">
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="chest-width">Chest width</label>
                            <input class="form-control" type="number" min="0" max="500" step="0.1" id="chest-width">
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="length">Length</label>
                            <input class="form-control" type="number" min="0" max="500" step="0.1" id="length">
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="waist">Waist width</label>
                            <input class="form-control" type="number" min="0" max="500" step="0.1" id="waist">
                        </div>
                        <div class="col-6 col-md-3">
                            <label class="form-label" for="inseam">Inseam</label>
                            <input class="form-control" type="number" min="0" max="500" step="0.1" id="inseam">
                        </div>
                    </div>

                    <hr class="my-4">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label" for="buying-price">Buying cost</label>
                            <input class="form-control" type="number" min="0" step="0.01" id="buying-price" value="0">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="selling-price">Planned selling price</label>
                            <input class="form-control" type="number" min="0" step="0.01" id="selling-price" value="0">
                        </div>
                    </div>
                </div>
                <div class="card-footer d-flex flex-column flex-sm-row gap-2 justify-content-end">
                    <button type="button" class="btn btn-outline-secondary" id="start-over">Discard and start over</button>
                    <button type="submit" class="btn btn-success btn-lg" id="save-garment">Save garment</button>
                </div>
            </form>
        </section>
    </div>
</div>

<style>
.camera-shell, .photo-preview { position: relative; aspect-ratio: 4 / 3; border-radius: 12px; overflow: hidden; background: #111827; }
.camera-shell video, .photo-preview img { width: 100%; height: 100%; object-fit: contain; }
.camera-guide { position: absolute; left: 1rem; right: 1rem; bottom: 1rem; padding: .5rem .75rem; border-radius: 8px; color: white; background: rgba(0,0,0,.62); text-align: center; }
.scan-progress { display: inline-flex; align-items: center; gap: .4rem; color: #6c757d; }
.scan-progress-number { display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 999px; background: #e9ecef; font-weight: 700; }
.scan-progress.active { color: var(--tblr-primary); font-weight: 700; }
.scan-progress.active .scan-progress-number { color: white; background: var(--tblr-primary); }
.scan-progress.done .scan-progress-number { color: white; background: var(--tblr-success); }
@media (max-width: 575px) { .scan-progress { width: 30%; font-size: .8rem; } }
</style>

<script>
document.addEventListener('DOMContentLoaded', () => {
    const photoSteps = @json($photoSteps);
    const MAX_PHONE_PHOTO_EDGE = 2048;
    const PHONE_PHOTO_QUALITY = 0.85;
    const state = {
        sessionId: null,
        currentStep: 1,
        stream: null,
        localPhotos: {},
        previews: {},
        scanIds: {},
    };

    const alertBox = document.getElementById('scan-alert');

    function showError(message) {
        alertBox.textContent = message;
        alertBox.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function clearError() {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }

    function setProgress(step) {
        for (let i = 1; i <= 5; i++) {
            const marker = document.getElementById(`progress-${i}`);
            marker.classList.toggle('active', i === step);
            marker.classList.toggle('done', i < step);
        }
    }

    function stopCamera() {
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
        }
    }

    async function startCamera(step) {
        stopCamera();
        const video = document.getElementById(`camera-${step}`);
        try {
            state.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
                audio: false,
            });
            video.srcObject = state.stream;
        } catch (error) {
            document.getElementById(`camera-shell-${step}`).innerHTML =
                '<div class="h-100 d-grid align-items-center text-center text-white p-4">Camera preview is unavailable. Use “phone camera or choose file” below.</div>';
        }
    }

    function previewPhoto(file, step) {
        clearError();
        if (!file || !file.type.startsWith('image/')) {
            showError('Please choose a photo.');
            return;
        }

        state.localPhotos[step] = file;
        if (state.previews[step]) URL.revokeObjectURL(state.previews[step]);
        state.previews[step] = URL.createObjectURL(file);
        document.getElementById(`preview-image-${step}`).src = state.previews[step];
        document.getElementById(`camera-shell-${step}`).style.display = 'none';
        document.getElementById(`photo-preview-${step}`).style.display = 'block';
        document.getElementById(`capture-actions-${step}`).style.display = 'none';
        document.getElementById(`confirm-actions-${step}`).style.display = 'block';
        stopCamera();
    }

    function loadPhoto(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('This phone photo could not be read. Try the in-app camera, or set your phone camera format to Most Compatible.'));
            };
            image.src = url;
        });
    }

    async function preparePhonePhoto(file, step) {
        clearError();
        if (!file || !file.type.startsWith('image/')) {
            showError('Please choose a photo.');
            return;
        }

        try {
            const image = await loadPhoto(file);
            const scale = Math.min(1, MAX_PHONE_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

            const jpeg = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error('The phone photo could not be prepared. Please try again.')),
                    'image/jpeg',
                    PHONE_PHOTO_QUALITY
                );
            });
            previewPhoto(jpeg, step);
        } catch (error) {
            showError(error.message);
        }
    }

    function capturePhoto(step) {
        const video = document.getElementById(`camera-${step}`);
        if (!video.videoWidth) {
            showError('The camera is not ready yet. Wait a moment or use the phone camera button.');
            return;
        }

        const canvas = document.getElementById(`canvas-${step}`);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => previewPhoto(blob, step), 'image/jpeg', 0.88);
    }

    function retake(step) {
        if (state.previews[step]) URL.revokeObjectURL(state.previews[step]);
        delete state.previews[step];
        delete state.localPhotos[step];
        document.getElementById(`preview-image-${step}`).removeAttribute('src');
        document.getElementById(`photo-preview-${step}`).style.display = 'none';
        document.getElementById(`camera-shell-${step}`).style.display = 'block';
        document.getElementById(`capture-actions-${step}`).style.display = 'block';
        document.getElementById(`confirm-actions-${step}`).style.display = 'none';
        startCamera(step);
    }

    function skipPhoto(step) {
        if (step !== 4) return;
        clearError();
        delete state.localPhotos[step];
        delete state.scanIds[step];
        goToStep(step + 1);
    }

    async function readJsonResponse(response, fallbackMessage) {
        try {
            return await response.json();
        } catch (error) {
            if (response.status === 413) {
                throw new Error('The photo is too large to upload. Please try again; the app will reduce the next photo automatically.');
            }
            throw new Error(fallbackMessage);
        }
    }

    function postJsonWithXhr(url, payload, fallbackMessage) {
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('POST', url, true);
            request.withCredentials = true;
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('Accept', 'application/json');
            request.setRequestHeader('X-CSRF-TOKEN', document.querySelector('meta[name="csrf-token"]').content);

            request.onload = () => {
                let result;
                try {
                    result = JSON.parse(request.responseText);
                } catch (error) {
                    reject(new Error(fallbackMessage));
                    return;
                }

                resolve({
                    ok: request.status >= 200 && request.status < 300,
                    status: request.status,
                    result,
                });
            };
            request.onerror = () => reject(new Error(fallbackMessage));
            request.ontimeout = () => reject(new Error('The save request timed out. Please check your connection and try again.'));
            request.timeout = 30000;
            request.send(JSON.stringify(payload));
        });
    }

    async function postJson(url, payload, fallbackMessage) {
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            // Some iOS browsers can reject a valid fetch request with a DOM pattern error.
            // XMLHttpRequest uses a separate networking path and preserves the same session.
            return postJsonWithXhr(url, payload, fallbackMessage);
        }

        return {
            ok: response.ok,
            status: response.status,
            result: await readJsonResponse(response, fallbackMessage),
        };
    }

    async function startSession() {
        const response = await fetch('{{ route('api.scanning.start') }}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            },
            body: JSON.stringify({
                session_type: 'regular_product',
                device_info: { inventory_mode: 'clothing', workflow_version: 1 },
            }),
        });
        const result = await readJsonResponse(response, 'Could not start the scan. Please refresh and try again.');
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not start the scan.');
        state.sessionId = result.session_id;
    }

    async function uploadPhoto(step) {
        clearError();
        if (!state.localPhotos[step]) return;
        if (!state.sessionId) await startSession();

        const uploading = document.getElementById(`uploading-${step}`);
        const button = document.querySelector(`[data-confirm="${step}"]`);
        uploading.style.display = 'block';
        button.disabled = true;

        const form = new FormData();
        form.append('session_id', state.sessionId);
        form.append('photo', state.localPhotos[step], `clothing-${step}.jpg`);
        form.append('photo_type', photoSteps[step].type);

        try {
            const response = await fetch('{{ route('api.scanning.upload') }}', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
                body: form,
            });
            const result = await readJsonResponse(response, 'The photo upload failed. Please try again.');
            if (!response.ok || !result.success) throw new Error(result.message || 'Photo upload failed.');
            state.scanIds[step] = result.photo_scan_id;
            goToStep(step + 1);
        } catch (error) {
            showError(error.message);
        } finally {
            uploading.style.display = 'none';
            button.disabled = false;
        }
    }

    function goToStep(step) {
        stopCamera();
        document.querySelectorAll('.scan-step').forEach(section => section.style.display = 'none');
        state.currentStep = step;
        document.getElementById(`scan-step-${step}`).style.display = 'block';
        setProgress(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (step <= 4) startCamera(step);
        if (step === 5) prepareReview();
    }

    async function prepareReview() {
        const maxAttempts = 45;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`{{ url('/api/scanning/session') }}/${state.sessionId}`);
            const result = await response.json();
            if (!response.ok || !result.success) {
                showError(result.message || 'Could not load the scan results.');
                return;
            }

            const scans = result.session.photo_scans || [];
            const uploadedCount = Object.keys(state.scanIds).length;
            const allFinished = scans.length >= uploadedCount && scans.every(scan => ['completed', 'failed'].includes(scan.processing_status));
            if (allFinished) {
                fillReview(scans);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        showError('The photos are taking longer than expected. You can still review and save the item manually.');
        fillReview([]);
    }

    function fillReview(scans) {
        const merged = {};
        const lists = { style_details: [], visible_flaws: [] };
        let bestCondition = null;

        scans.forEach(scan => {
            const info = scan.classification_results || {};
            Object.entries(info).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    if (lists[key]) lists[key].push(...value);
                } else if (value !== null && value !== '' && merged[key] == null) {
                    merged[key] = value;
                }
            });
            if (scan.detected_condition) bestCondition = scan.detected_condition;
        });

        lists.style_details = [...new Set(lists.style_details.filter(Boolean))];
        lists.visible_flaws = [...new Set(lists.visible_flaws.filter(Boolean))];

        const generatedTitle = [merged.brand, merged.color, merged.garment_type].filter(Boolean).join(' ');
        setValue('name', merged.suggested_title || generatedTitle);
        setValue('garment-type', merged.garment_type);
        setValue('department', merged.department);
        setValue('brand', merged.brand);
        setValue('size-label', merged.size_label);
        setValue('color', merged.color);
        setValue('pattern', merged.pattern);
        setValue('material', merged.material);
        setValue('condition', bestCondition || 'good');
        setValue('style-details', lists.style_details.join(', '));
        setValue('visible-flaws', lists.visible_flaws.join(', '));
        setValue('condition-notes', merged.condition_notes || lists.visible_flaws.join('; '));
        selectCategory(merged.category || merged.garment_type);

        document.getElementById('processing-card').style.display = 'none';
        document.getElementById('clothing-review').style.display = 'block';
    }

    function setValue(id, value) {
        if (value !== null && value !== undefined && value !== '') {
            document.getElementById(id).value = value;
        }
    }

    function selectCategory(suggestion) {
        if (!suggestion) return;
        const select = document.getElementById('category');
        const needle = suggestion.toLowerCase();
        const option = [...select.options].find(item =>
            item.value && (item.text.toLowerCase().includes(needle) || needle.includes(item.text.toLowerCase()))
        );
        if (option) select.value = option.value;
    }

    function listValue(id) {
        return document.getElementById(id).value
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
    }

    function numberOrNull(id) {
        const value = document.getElementById(id).value;
        return value === '' ? null : Number(value);
    }

    document.getElementById('clothing-review').addEventListener('submit', async event => {
        event.preventDefault();
        clearError();
        const saveButton = document.getElementById('save-garment');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';

        const payload = {
            create_products: true,
            product_data: {
                inventory_mode: 'clothing',
                name: document.getElementById('name').value.trim(),
                category_id: Number(document.getElementById('category').value),
                unit_id: Number(document.getElementById('unit').value),
                garment_type: document.getElementById('garment-type').value.trim() || null,
                department: document.getElementById('department').value || null,
                brand: document.getElementById('brand').value.trim() || null,
                size_label: document.getElementById('size-label').value.trim() || null,
                color: document.getElementById('color').value.trim() || null,
                pattern: document.getElementById('pattern').value.trim() || null,
                material: document.getElementById('material').value.trim() || null,
                condition_status: document.getElementById('condition').value,
                condition_notes: document.getElementById('condition-notes').value.trim() || null,
                style_details: listValue('style-details'),
                visible_flaws: listValue('visible-flaws'),
                storage_location: document.getElementById('storage-location').value.trim() || null,
                inventory_status: document.getElementById('inventory-status').value,
                measurements: {
                    chest_width: numberOrNull('chest-width'),
                    length: numberOrNull('length'),
                    waist: numberOrNull('waist'),
                    inseam: numberOrNull('inseam'),
                },
                buying_price: numberOrNull('buying-price') || 0,
                selling_price: numberOrNull('selling-price') || 0,
            },
        };

        try {
            const saveRequest = await postJson(
                `/api/scanning/session/${state.sessionId}/complete`,
                payload,
                'The garment could not be saved. Please try again.'
            );
            if (!saveRequest.ok || !saveRequest.result.success) {
                throw new Error(saveRequest.result.message || 'The garment could not be saved.');
            }
        } catch (error) {
            showError(`Save failed: ${error.message}`);
            saveButton.disabled = false;
            saveButton.textContent = 'Save garment';
            return;
        }

        // Keep navigation outside the save error handler so a browser navigation
        // quirk can never make a successfully saved garment look like a failure.
        window.location.replace('/clothing');
    });

    document.querySelectorAll('[data-capture]').forEach(button =>
        button.addEventListener('click', () => capturePhoto(Number(button.dataset.capture)))
    );
    document.querySelectorAll('[data-confirm]').forEach(button =>
        button.addEventListener('click', () => uploadPhoto(Number(button.dataset.confirm)))
    );
    document.querySelectorAll('[data-retake]').forEach(button =>
        button.addEventListener('click', () => retake(Number(button.dataset.retake)))
    );
    document.querySelectorAll('[data-skip]').forEach(button =>
        button.addEventListener('click', () => skipPhoto(Number(button.dataset.skip)))
    );
    for (let step = 1; step <= 4; step++) {
        document.getElementById(`file-${step}`).addEventListener('change', async event => {
            if (event.target.files[0]) await preparePhonePhoto(event.target.files[0], step);
            event.target.value = '';
        });
    }
    document.getElementById('start-over').addEventListener('click', () => {
        if (confirm('Discard this garment and start again?')) window.location.reload();
    });
    window.addEventListener('beforeunload', stopCamera);

    setProgress(1);
    startCamera(1);
});
</script>
@endsection

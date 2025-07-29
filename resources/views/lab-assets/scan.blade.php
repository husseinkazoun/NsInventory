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
                        Photo Scanning
                    </h2>
                </div>
                <div class="col-12 col-md-auto ms-auto d-print-none">
                    <div class="btn-list">
                        <a href="{{ route('lab-assets.dashboard') }}" class="btn btn-outline-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M5 12l14 0"/>
                                <path d="M5 12l6 6"/>
                                <path d="M5 12l6 -6"/>
                            </svg>
                            Back to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Scanning Interface -->
        <div id="scanning-app">
            <!-- Loading State -->
            <div id="loading-state" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Initializing scanning interface...</p>
            </div>

            <!-- Main Scanning Interface (Hidden initially) -->
            <div id="scanning-interface" style="display: none;">
                <!-- Progress Steps -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="steps steps-counter steps-lime">
                            <a href="#" class="step-item active" id="step-1">
                                <span class="step-counter">1</span>
                                <span class="step-name">Device Overview</span>
                            </a>
                            <a href="#" class="step-item" id="step-2">
                                <span class="step-counter">2</span>
                                <span class="step-name">Serial & Labels</span>
                            </a>
                            <a href="#" class="step-item" id="step-3">
                                <span class="step-counter">3</span>
                                <span class="step-name">Components</span>
                            </a>
                            <a href="#" class="step-item" id="step-4">
                                <span class="step-counter">4</span>
                                <span class="step-name">Review & Save</span>
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Step 1: Device Overview -->
                <div class="step-content" id="step-1-content">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Step 1: Device Overview Photo</h3>
                            <div class="card-subtitle">Take a clear photo of the entire device</div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="camera-container">
                                        <video id="camera-1" class="camera-preview" autoplay playsinline></video>
                                        <canvas id="canvas-1" style="display: none;"></canvas>
                                        <div class="camera-overlay">
                                            <div class="camera-frame"></div>
                                        </div>
                                    </div>
                                    <div class="text-center mt-3">
                                        <button class="btn btn-primary btn-lg" id="capture-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                <circle cx="12" cy="13" r="3"/>
                                                <path d="m12 1 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
                                            </svg>
                                            Capture Photo
                                        </button>
                                        <input type="file" id="file-1" accept="image/*" style="display: none;">
                                        <button class="btn btn-outline-secondary ms-2" onclick="document.getElementById('file-1').click()">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
                                                <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>
                                                <path d="M12 11v6"/>
                                                <path d="M9 14h6"/>
                                            </svg>
                                            Upload File
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="preview-container" id="preview-1" style="display: none;">
                                        <img id="preview-img-1" class="img-fluid rounded">
                                        <div class="mt-3">
                                            <button class="btn btn-success" id="next-1">
                                                Next Step
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon ms-1" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                    <path d="M5 12l14 0"/>
                                                    <path d="M13 18l6 -6"/>
                                                    <path d="M13 6l6 6"/>
                                                </svg>
                                            </button>
                                            <button class="btn btn-outline-secondary ms-2" id="retake-1">Retake</button>
                                        </div>
                                    </div>
                                    <div class="instructions">
                                        <h4>Instructions:</h4>
                                        <ul>
                                            <li>Position the device in good lighting</li>
                                            <li>Ensure the entire device is visible</li>
                                            <li>Keep the camera steady</li>
                                            <li>Avoid shadows and reflections</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Serial & Labels -->
                <div class="step-content" id="step-2-content" style="display: none;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Step 2: Serial Numbers & Labels</h3>
                            <div class="card-subtitle">Capture close-up photos of all labels and stickers</div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="camera-container">
                                        <video id="camera-2" class="camera-preview" autoplay playsinline></video>
                                        <canvas id="canvas-2" style="display: none;"></canvas>
                                    </div>
                                    <div class="text-center mt-3">
                                        <button class="btn btn-primary btn-lg" id="capture-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                <circle cx="12" cy="13" r="3"/>
                                                <path d="m12 1 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
                                            </svg>
                                            Capture Photo
                                        </button>
                                        <input type="file" id="file-2" accept="image/*" style="display: none;">
                                        <button class="btn btn-outline-secondary ms-2" onclick="document.getElementById('file-2').click()">Upload File</button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="preview-container" id="preview-2" style="display: none;">
                                        <img id="preview-img-2" class="img-fluid rounded">
                                        <div class="mt-3">
                                            <button class="btn btn-success" id="next-2">Next Step</button>
                                            <button class="btn btn-outline-secondary ms-2" id="retake-2">Retake</button>
                                        </div>
                                    </div>
                                    <div class="instructions">
                                        <h4>Look for:</h4>
                                        <ul>
                                            <li>Serial number stickers</li>
                                            <li>Model number labels</li>
                                            <li>Manufacturer information</li>
                                            <li>Asset tags or barcodes</li>
                                            <li>Service tags</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 3: Components -->
                <div class="step-content" id="step-3-content" style="display: none;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Step 3: Components Check</h3>
                            <div class="card-subtitle">Photo of all cables, accessories, and components</div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="camera-container">
                                        <video id="camera-3" class="camera-preview" autoplay playsinline></video>
                                        <canvas id="canvas-3" style="display: none;"></canvas>
                                    </div>
                                    <div class="text-center mt-3">
                                        <button class="btn btn-primary btn-lg" id="capture-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                <circle cx="12" cy="13" r="3"/>
                                                <path d="m12 1 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
                                            </svg>
                                            Capture Photo
                                        </button>
                                        <input type="file" id="file-3" accept="image/*" style="display: none;">
                                        <button class="btn btn-outline-secondary ms-2" onclick="document.getElementById('file-3').click()">Upload File</button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="preview-container" id="preview-3" style="display: none;">
                                        <img id="preview-img-3" class="img-fluid rounded">
                                        <div class="mt-3">
                                            <button class="btn btn-success" id="next-3">Next Step</button>
                                            <button class="btn btn-outline-secondary ms-2" id="retake-3">Retake</button>
                                        </div>
                                    </div>
                                    <div class="instructions">
                                        <h4>Check for:</h4>
                                        <ul>
                                            <li>Power cables and adapters</li>
                                            <li>Network/Ethernet cables</li>
                                            <li>USB cables</li>
                                            <li>Mouse and keyboard</li>
                                            <li>Monitor cables (HDMI, VGA, etc.)</li>
                                            <li>Any other accessories</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 4: Review & Save -->
                <div class="step-content" id="step-4-content" style="display: none;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Step 4: Review & Save</h3>
                            <div class="card-subtitle">Review captured photos and extracted information</div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div id="processing-status" class="alert alert-info">
                                        <div class="d-flex">
                                            <div class="spinner-border spinner-border-sm me-3" role="status"></div>
                                            <div>
                                                <h4 class="alert-title">Processing photos...</h4>
                                                <div class="text-muted">AI is analyzing your photos to extract device information.</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="extracted-info" style="display: none;">
                                        <h4>Extracted Information:</h4>
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label class="form-label">Device Name</label>
                                                    <input type="text" class="form-control" id="device-name" placeholder="Auto-detected">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label">Manufacturer</label>
                                                    <input type="text" class="form-control" id="manufacturer" placeholder="Auto-detected">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label">Model</label>
                                                    <input type="text" class="form-control" id="model" placeholder="Auto-detected">
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label class="form-label">Serial Number</label>
                                                    <input type="text" class="form-control" id="serial-number" placeholder="Auto-detected">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label">Condition</label>
                                                    <select class="form-select" id="condition">
                                                        <option value="excellent">Excellent</option>
                                                        <option value="good" selected>Good</option>
                                                        <option value="fair">Fair</option>
                                                        <option value="poor">Poor</option>
                                                        <option value="broken">Broken</option>
                                                    </select>
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label">Location</label>
                                                    <input type="text" class="form-control" id="location" placeholder="e.g., Lab Room 101">
                                                </div>
                                            </div>
                                        </div>

                                        <div id="missing-components" style="display: none;">
                                            <h5>Missing Components:</h5>
                                            <div id="missing-components-list"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <h5>Captured Photos:</h5>
                                    <div id="photo-thumbnails"></div>
                                </div>
                            </div>

                            <div class="mt-4">
                                <button class="btn btn-success btn-lg" id="save-asset" style="display: none;">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <path d="M5 12l5 5l10 -10"/>
                                    </svg>
                                    Save Lab Asset
                                </button>
                                <button class="btn btn-outline-secondary ms-2" id="start-over">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/>
                                        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>
                                    </svg>
                                    Start Over
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.camera-container {
    position: relative;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    aspect-ratio: 4/3;
}

.camera-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.camera-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.camera-frame {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    height: 80%;
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 8px;
}

.preview-container img {
    max-height: 300px;
    width: 100%;
    object-fit: contain;
    border: 1px solid #dee2e6;
}

.instructions {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
}

.instructions h4 {
    margin-bottom: 0.5rem;
    color: #495057;
}

.instructions ul {
    margin-bottom: 0;
    padding-left: 1.2rem;
}

.instructions li {
    margin-bottom: 0.25rem;
    color: #6c757d;
}

#photo-thumbnails img {
    width: 100%;
    margin-bottom: 0.5rem;
    border-radius: 4px;
    border: 1px solid #dee2e6;
}
</style>

<script>
// Scanning interface JavaScript will be loaded here
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the scanning interface
    initializeScanningInterface();
});

function initializeScanningInterface() {
    // Hide loading state and show interface
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('scanning-interface').style.display = 'block';
    
    // Initialize camera for step 1
    initializeCamera(1);
    
    // Set up event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Capture buttons
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`capture-${i}`).addEventListener('click', () => capturePhoto(i));
        document.getElementById(`retake-${i}`).addEventListener('click', () => retakePhoto(i));
        document.getElementById(`next-${i}`).addEventListener('click', () => nextStep(i));
        document.getElementById(`file-${i}`).addEventListener('change', (e) => handleFileUpload(e, i));
    }
    
    // Save and start over buttons
    document.getElementById('save-asset').addEventListener('click', saveAsset);
    document.getElementById('start-over').addEventListener('click', startOver);
}

let currentSession = null;
let capturedPhotos = {};

async function initializeCamera(step) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        document.getElementById(`camera-${step}`).srcObject = stream;
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Unable to access camera. Please use the file upload option.');
    }
}

async function capturePhoto(step) {
    const video = document.getElementById(`camera-${step}`);
    const canvas = document.getElementById(`canvas-${step}`);
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
        await uploadPhoto(blob, step);
    }, 'image/jpeg', 0.8);
}

function handleFileUpload(event, step) {
    const file = event.target.files[0];
    if (file) {
        uploadPhoto(file, step);
    }
}

async function uploadPhoto(blob, step) {
    if (!currentSession) {
        await startScanningSession();
    }
    
    const formData = new FormData();
    formData.append('session_id', currentSession.id);
    formData.append('photo', blob);
    formData.append('photo_type', getPhotoType(step));
    
    try {
        const response = await fetch('/api/scanning/upload', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showPhotoPreview(blob, step);
            capturedPhotos[step] = result.photo_scan_id;
        } else {
            alert('Failed to upload photo: ' + result.message);
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload photo. Please try again.');
    }
}

async function startScanningSession() {
    try {
        const response = await fetch('/api/scanning/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            },
            body: JSON.stringify({
                session_type: 'lab_asset',
                location: document.getElementById('location')?.value || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentSession = { id: result.session_id };
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Session start error:', error);
        alert('Failed to start scanning session. Please refresh and try again.');
    }
}

function getPhotoType(step) {
    const types = {
        1: 'overview',
        2: 'serial_label',
        3: 'components'
    };
    return types[step];
}

function showPhotoPreview(blob, step) {
    const url = URL.createObjectURL(blob);
    const img = document.getElementById(`preview-img-${step}`);
    img.src = url;
    document.getElementById(`preview-${step}`).style.display = 'block';
    
    // Hide camera
    const video = document.getElementById(`camera-${step}`);
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}

function retakePhoto(step) {
    document.getElementById(`preview-${step}`).style.display = 'none';
    initializeCamera(step);
    delete capturedPhotos[step];
}

function nextStep(step) {
    // Hide current step
    document.getElementById(`step-${step}-content`).style.display = 'none';
    document.getElementById(`step-${step}`).classList.remove('active');
    
    if (step < 3) {
        // Show next step
        const nextStepNum = step + 1;
        document.getElementById(`step-${nextStepNum}-content`).style.display = 'block';
        document.getElementById(`step-${nextStepNum}`).classList.add('active');
        initializeCamera(nextStepNum);
    } else {
        // Show review step
        document.getElementById('step-4-content').style.display = 'block';
        document.getElementById('step-4').classList.add('active');
        processPhotos();
    }
}

async function processPhotos() {
    // Show processing status
    document.getElementById('processing-status').style.display = 'block';
    
    // Wait for photos to be processed
    await waitForProcessing();
    
    // Hide processing status and show results
    document.getElementById('processing-status').style.display = 'none';
    document.getElementById('extracted-info').style.display = 'block';
    document.getElementById('save-asset').style.display = 'inline-block';
    
    // Show photo thumbnails
    showPhotoThumbnails();
}

async function waitForProcessing() {
    // Poll the session status until processing is complete
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`/api/scanning/session/${currentSession.id}`);
            const result = await response.json();
            
            if (result.success) {
                const session = result.session;
                if (session.processed_photos >= session.total_photos) {
                    // All photos processed, extract information
                    extractInformation(session.photo_scans);
                    break;
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
}

function extractInformation(photoScans) {
    // Extract and populate information from processed scans
    let deviceName = '';
    let manufacturer = '';
    let model = '';
    let serialNumber = '';
    let condition = 'good';
    let missingComponents = [];
    
    photoScans.forEach(scan => {
        if (scan.extracted_manufacturer) manufacturer = scan.extracted_manufacturer;
        if (scan.extracted_model) model = scan.extracted_model;
        if (scan.extracted_serial) serialNumber = scan.extracted_serial;
        if (scan.detected_condition) condition = scan.detected_condition;
        if (scan.missing_components) missingComponents = missingComponents.concat(scan.missing_components);
    });
    
    // Generate device name
    if (manufacturer && model) {
        deviceName = `${manufacturer} ${model}`;
    } else if (manufacturer) {
        deviceName = `${manufacturer} Device`;
    } else {
        deviceName = 'Unknown Device';
    }
    
    // Populate form fields
    document.getElementById('device-name').value = deviceName;
    document.getElementById('manufacturer').value = manufacturer;
    document.getElementById('model').value = model;
    document.getElementById('serial-number').value = serialNumber;
    document.getElementById('condition').value = condition;
    
    // Show missing components if any
    if (missingComponents.length > 0) {
        showMissingComponents(missingComponents);
    }
}

function showMissingComponents(components) {
    const container = document.getElementById('missing-components-list');
    container.innerHTML = '';
    
    components.forEach(component => {
        const div = document.createElement('div');
        div.className = 'alert alert-warning';
        div.innerHTML = `
            <strong>${component.component_name}</strong>
            ${component.required ? '<span class="badge bg-danger ms-2">Required</span>' : '<span class="badge bg-secondary ms-2">Optional</span>'}
        `;
        container.appendChild(div);
    });
    
    document.getElementById('missing-components').style.display = 'block';
}

function showPhotoThumbnails() {
    const container = document.getElementById('photo-thumbnails');
    container.innerHTML = '';
    
    for (let i = 1; i <= 3; i++) {
        if (capturedPhotos[i]) {
            const img = document.getElementById(`preview-img-${i}`);
            if (img && img.src) {
                const thumbnail = document.createElement('img');
                thumbnail.src = img.src;
                thumbnail.className = 'img-fluid rounded mb-2';
                container.appendChild(thumbnail);
            }
        }
    }
}

async function saveAsset() {
    const assetData = {
        create_products: true,
        product_data: {
            name: document.getElementById('device-name').value,
            category_id: 1, // Default category - you might want to make this selectable
            unit_id: 1 // Default unit - you might want to make this selectable
        }
    };
    
    try {
        const response = await fetch(`/api/scanning/session/${currentSession.id}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            },
            body: JSON.stringify(assetData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Lab asset saved successfully!');
            window.location.href = '{{ route("lab-assets.dashboard") }}';
        } else {
            alert('Failed to save asset: ' + result.message);
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save asset. Please try again.');
    }
}

function startOver() {
    if (confirm('Are you sure you want to start over? All captured photos will be lost.')) {
        window.location.reload();
    }
}
</script>
@endsection

@push('styles')
<meta name="csrf-token" content="{{ csrf_token() }}">
@endpush


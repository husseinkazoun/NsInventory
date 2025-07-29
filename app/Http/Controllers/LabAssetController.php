<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Category;
use App\Models\Unit;
use App\Models\User;
use App\Models\MissingComponent;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class LabAssetController extends Controller
{
    public function index()
    {
        $labAssets = Product::labAssets()
            ->with(['category', 'unit', 'assignedUser', 'missingComponents'])
            ->latest()
            ->paginate(20);

        $stats = [
            'total_assets' => Product::labAssets()->count(),
            'active_assets' => Product::labAssets()->where('asset_status', 'active')->count(),
            'assigned_assets' => Product::labAssets()->whereNotNull('assigned_to')->count(),
            'missing_components' => MissingComponent::whereHas('product', function($query) {
                $query->where('product_type', 'lab_asset');
            })->where('status', 'missing')->count(),
            'maintenance_due' => Product::labAssets()
                ->where('next_maintenance', '<=', now()->addDays(7))
                ->count(),
        ];

        return view('lab-assets.index', compact('labAssets', 'stats'));
    }

    public function create()
    {
        $categories = Category::all();
        $units = Unit::all();
        $users = User::all();

        return view('lab-assets.create', compact('categories', 'units', 'users'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'serial_number' => 'nullable|string|unique:products,serial_number',
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'part_number' => 'nullable|string|max:255',
            'asset_tag' => 'nullable|string|unique:products,asset_tag',
            'location' => 'nullable|string|max:255',
            'room' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:100',
            'assigned_to' => 'nullable|exists:users,id',
            'condition_status' => 'required|in:excellent,good,fair,poor,broken',
            'buying_price' => 'nullable|numeric|min:0',
            'warranty_expiry' => 'nullable|date',
            'category_id' => 'required|exists:categories,id',
            'unit_id' => 'required|exists:units,id',
            'specifications' => 'nullable|array',
            'notes' => 'nullable|string',
            'product_image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        // Generate unique code and slug
        $validated['code'] = $this->generateUniqueCode();
        $validated['slug'] = Str::slug($validated['name'] . '-' . $validated['code']);
        $validated['product_type'] = 'lab_asset';
        $validated['quantity'] = 1; // Lab assets are typically single items
        $validated['quantity_alert'] = 1;
        $validated['asset_status'] = 'active';

        // Handle assignment date
        if ($validated['assigned_to']) {
            $validated['assignment_date'] = now()->toDateString();
        }

        // Handle image upload
        if ($request->hasFile('product_image')) {
            $validated['product_image'] = $request->file('product_image')->store('products', 'public');
        }

        $labAsset = Product::create($validated);

        return redirect()->route('lab-assets.show', $labAsset)
            ->with('success', 'Lab asset created successfully.');
    }

    public function show(Product $labAsset)
    {
        if (!$labAsset->isLabAsset()) {
            abort(404);
        }

        $labAsset->load(['category', 'unit', 'assignedUser', 'missingComponents.resolvedBy', 'photoScans.scanningSession']);

        $recentScans = $labAsset->photoScans()
            ->with('scanningSession.user')
            ->latest()
            ->take(5)
            ->get();

        return view('lab-assets.show', compact('labAsset', 'recentScans'));
    }

    public function edit(Product $labAsset)
    {
        if (!$labAsset->isLabAsset()) {
            abort(404);
        }

        $categories = Category::all();
        $units = Unit::all();
        $users = User::all();

        return view('lab-assets.edit', compact('labAsset', 'categories', 'units', 'users'));
    }

    public function update(Request $request, Product $labAsset)
    {
        if (!$labAsset->isLabAsset()) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'serial_number' => 'nullable|string|unique:products,serial_number,' . $labAsset->id,
            'model' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'part_number' => 'nullable|string|max:255',
            'asset_tag' => 'nullable|string|unique:products,asset_tag,' . $labAsset->id,
            'location' => 'nullable|string|max:255',
            'room' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:100',
            'assigned_to' => 'nullable|exists:users,id',
            'condition_status' => 'required|in:excellent,good,fair,poor,broken',
            'asset_status' => 'required|in:active,inactive,maintenance,disposed',
            'buying_price' => 'nullable|numeric|min:0',
            'warranty_expiry' => 'nullable|date',
            'last_maintenance' => 'nullable|date',
            'next_maintenance' => 'nullable|date',
            'category_id' => 'required|exists:categories,id',
            'unit_id' => 'required|exists:units,id',
            'specifications' => 'nullable|array',
            'notes' => 'nullable|string',
            'product_image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        // Update slug if name changed
        if ($validated['name'] !== $labAsset->name) {
            $validated['slug'] = Str::slug($validated['name'] . '-' . $labAsset->code);
        }

        // Handle assignment changes
        if ($validated['assigned_to'] !== $labAsset->assigned_to) {
            if ($validated['assigned_to']) {
                $validated['assignment_date'] = now()->toDateString();
            } else {
                $validated['assignment_date'] = null;
            }
        }

        // Handle image upload
        if ($request->hasFile('product_image')) {
            // Delete old image
            if ($labAsset->product_image) {
                Storage::disk('public')->delete($labAsset->product_image);
            }
            $validated['product_image'] = $request->file('product_image')->store('products', 'public');
        }

        $labAsset->update($validated);

        return redirect()->route('lab-assets.show', $labAsset)
            ->with('success', 'Lab asset updated successfully.');
    }

    public function destroy(Product $labAsset)
    {
        if (!$labAsset->isLabAsset()) {
            abort(404);
        }

        // Delete associated image
        if ($labAsset->product_image) {
            Storage::disk('public')->delete($labAsset->product_image);
        }

        $labAsset->delete();

        return redirect()->route('lab-assets.index')
            ->with('success', 'Lab asset deleted successfully.');
    }

    public function dashboard()
    {
        $stats = [
            'total_assets' => Product::labAssets()->count(),
            'active_assets' => Product::labAssets()->where('asset_status', 'active')->count(),
            'assigned_assets' => Product::labAssets()->whereNotNull('assigned_to')->count(),
            'missing_components' => MissingComponent::whereHas('product', function($query) {
                $query->where('product_type', 'lab_asset');
            })->where('status', 'missing')->count(),
            'maintenance_due' => Product::labAssets()
                ->where('next_maintenance', '<=', now()->addDays(7))
                ->count(),
            'warranty_expiring' => Product::labAssets()
                ->where('warranty_expiry', '<=', now()->addDays(30))
                ->count(),
        ];

        $recentAssets = Product::labAssets()
            ->with(['assignedUser', 'missingComponents'])
            ->latest()
            ->take(5)
            ->get();

        $maintenanceDue = Product::labAssets()
            ->with('assignedUser')
            ->where('next_maintenance', '<=', now()->addDays(7))
            ->orderBy('next_maintenance')
            ->take(5)
            ->get();

        $missingComponents = MissingComponent::with(['product', 'resolvedBy'])
            ->whereHas('product', function($query) {
                $query->where('product_type', 'lab_asset');
            })
            ->where('status', 'missing')
            ->latest()
            ->take(10)
            ->get();

        return view('lab-assets.dashboard', compact('stats', 'recentAssets', 'maintenanceDue', 'missingComponents'));
    }

    public function scan()
    {
        return view('lab-assets.scan');
    }

    private function generateUniqueCode(): string
    {
        do {
            $code = 'LA-' . strtoupper(Str::random(6));
        } while (Product::where('code', $code)->exists());

        return $code;
    }
}


<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClothingInventoryController extends Controller
{
    public function index()
    {
        $query = $this->clothingProducts();

        $items = (clone $query)
            ->with(['category', 'unit'])
            ->latest()
            ->paginate(20);

        $stats = [
            'total' => (clone $query)->count(),
            'to_process' => (clone $query)->where('specifications->inventory_status', 'to_process')->count(),
            'ready' => (clone $query)->where('specifications->inventory_status', 'ready')->count(),
            'listed' => (clone $query)->where('specifications->inventory_status', 'listed')->count(),
            'sold' => (clone $query)->where('specifications->inventory_status', 'sold')->count(),
        ];

        return view('clothing.index', compact('items', 'stats'));
    }

    public function scan()
    {
        $categories = Category::orderBy('name')->get(['id', 'name']);
        $units = Unit::orderBy('name')->get(['id', 'name', 'short_code']);

        return view('clothing.scan', compact('categories', 'units'));
    }

    public function export(): StreamedResponse
    {
        $items = $this->clothingProducts()
            ->with(['category', 'unit'])
            ->orderBy('id')
            ->get();

        return response()->streamDownload(function () use ($items) {
            $output = fopen('php://output', 'w');

            // UTF-8 BOM keeps accented and Arabic text readable when imported.
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, [
                'Item ID', 'Title', 'Category', 'Garment Type', 'Department', 'Brand',
                'Tagged Size', 'Color', 'Pattern', 'Material', 'Condition',
                'Condition Notes', 'Visible Flaws', 'Chest Width (cm)', 'Length (cm)',
                'Waist (cm)', 'Inseam (cm)', 'Buying Price', 'Selling Price',
                'Status', 'Storage Location', 'Photo URL', 'Date Added',
            ]);

            foreach ($items as $item) {
                $details = $item->specifications ?? [];
                $measurements = $details['measurements_cm'] ?? [];

                fputcsv($output, [
                    $item->code,
                    $item->name,
                    $item->category?->name,
                    $details['garment_type'] ?? null,
                    $details['department'] ?? null,
                    $details['brand'] ?? $item->manufacturer,
                    $details['size_label'] ?? null,
                    $details['color'] ?? null,
                    $details['pattern'] ?? null,
                    $details['material'] ?? null,
                    $item->condition_status,
                    $details['condition_notes'] ?? $item->notes,
                    implode('; ', $details['visible_flaws'] ?? []),
                    $measurements['chest_width'] ?? null,
                    $measurements['length'] ?? null,
                    $measurements['waist'] ?? null,
                    $measurements['inseam'] ?? null,
                    $item->buying_price,
                    $item->selling_price,
                    $details['inventory_status'] ?? 'to_process',
                    $details['storage_location'] ?? $item->location,
                    $item->product_image ? asset('storage/products/' . $item->product_image) : null,
                    $item->created_at?->toDateString(),
                ]);
            }

            fclose($output);
        }, 'sanad-clothing-inventory.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function clothingProducts()
    {
        return Product::regularProducts()
            ->where('specifications->inventory_mode', 'clothing');
    }
}

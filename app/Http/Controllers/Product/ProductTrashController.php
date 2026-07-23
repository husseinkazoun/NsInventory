<?php

namespace App\Http\Controllers\Product;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Trash for deleted products (administrators only).
 *
 * Deleting a product anywhere in the app now soft-deletes it, so it lands here
 * with its image and raw scan photos untouched and can be restored. Permanent
 * deletion is a separate action that must be confirmed by typing the product
 * code, and it still never removes raw scan photos.
 *
 * Trashed products are looked up by id rather than by the model's route key
 * (slug), because route-model binding applies the soft-delete scope and would
 * not find them.
 */
class ProductTrashController extends Controller
{
    public function index(): View
    {
        return view('products.trash', [
            'products' => Product::onlyTrashed()
                ->orderByDesc('deleted_at')
                ->get(),
        ]);
    }

    public function restore(string $id): RedirectResponse
    {
        $product = Product::onlyTrashed()->findOrFail($id);

        $product->restore();

        return redirect()
            ->route('products.trash.index')
            ->with('success', 'Product "'.$product->code.'" has been restored.');
    }

    /**
     * Permanently delete a trashed product. Requires the product code to be
     * typed back, so this can never be a single accidental click.
     *
     * No files are removed: the product image and every raw scan photo stay on
     * disk, and the photo_scans rows survive (their product_id is set to null
     * by the foreign key), so the scans themselves are never lost.
     */
    public function forceDelete(Request $request, string $id): RedirectResponse
    {
        $product = Product::onlyTrashed()->findOrFail($id);

        $request->validate([
            'confirmation' => ['required', 'string'],
        ]);

        if ($request->input('confirmation') !== $product->code) {
            return redirect()
                ->route('products.trash.index')
                ->withErrors([
                    'confirmation' => 'Type the product code "'.$product->code.'" exactly to permanently delete it. Nothing was deleted.',
                ]);
        }

        $product->forceDelete();

        return redirect()
            ->route('products.trash.index')
            ->with('success', 'Product permanently deleted. Its raw scan photos were preserved.');
    }
}

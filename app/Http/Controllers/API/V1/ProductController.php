<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Resources\PublicProductResource;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController
{
    public function index(Request $request)
    {
        $query = Product::regularProducts();

        if ($request->has('category_id')) {
            $query->where('category_id', $request->get('category_id'));
        }

        // Return a strict public field allow-list so the unauthenticated
        // endpoint never exposes cost/margin or internal operational data.
        // resolve() keeps the original top-level JSON array shape (no "data"
        // envelope) so existing consumers of this endpoint are not broken.
        return response()->json(
            PublicProductResource::collection($query->get())->resolve($request)
        );
    }
}

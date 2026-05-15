<?php

namespace App\Http\Controllers\API\V1;

use App\Models\Product;
use Illuminate\Http\Request;

class ProductController
{
    public function index(Request $request){

        $query = Product::regularProducts();

        if ($request->has('category_id')) {
            $query->where('category_id', $request->get('category_id'));
        }

        return response()->json($query->get());
    }
}

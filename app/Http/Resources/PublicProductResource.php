<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public catalog representation of a Product for the unauthenticated
 * GET /api/products endpoint.
 *
 * This is an allow-list: only the fields named below are ever serialised.
 * Internal / business-sensitive columns are deliberately excluded so they can
 * never leak to anonymous callers, in particular:
 *   - buying_price (cost — would reveal margins)
 *   - tax, tax_type
 *   - notes, specifications, scan_data, scan_confidence, last_scanned
 *   - serial_number, asset_tag
 *   - location, room, department, assigned_to, assignment_date
 *   - last_maintenance, next_maintenance, warranty_expiry
 *   - slug, quantity_alert, timestamps
 *
 * selling_price is included because it is the customer-facing catalogue price;
 * drop it from this array too if the public catalogue should not expose prices.
 */
class PublicProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'product_type' => $this->product_type,
            'model' => $this->model,
            'manufacturer' => $this->manufacturer,
            'part_number' => $this->part_number,
            'quantity' => $this->quantity,
            'selling_price' => $this->selling_price,
            'product_image' => $this->product_image,
            'category_id' => $this->category_id,
            'unit_id' => $this->unit_id,
            'condition_status' => $this->condition_status,
            'asset_status' => $this->asset_status,
        ];
    }
}

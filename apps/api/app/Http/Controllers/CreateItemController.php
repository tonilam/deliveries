<?php

namespace App\Http\Controllers;

use App\Enums\ItemDisplayUnit;
use App\Http\Requests\StoreItemRequest;
use App\Models\Item;
use App\Models\Load;
use App\Services\LoadActivityLogger;
use Illuminate\Http\JsonResponse;

class CreateItemController extends Controller
{
    public function __invoke(StoreItemRequest $request, LoadActivityLogger $activityLogger): JsonResponse
    {
        $loadId = $request->input('load_id');

        $item = Item::query()->create([
            'company_id' => $request->user()->company_id,
            'load_id' => is_numeric($loadId) ? (int) $loadId : null,
            'good_type_code' => $request->string('good_type_code')->toString(),
            'weight_tonnes' => $request->input('weight_tonnes'),
            'quantity' => (int) $request->input('quantity'),
            'display_unit' => ItemDisplayUnit::from($request->string('display_unit')->toString()),
            'order_number' => $request->input('order_number'),
            'connote' => $request->input('connote'),
        ]);

        $item->load('goodType');

        if ($item->load_id !== null) {
            $load = Load::query()
                ->where('company_id', $request->user()->company_id)
                ->whereKey($item->load_id)
                ->first();
            if ($load !== null) {
                $activityLogger->itemAssigned($load, $item, $request->user());
            }
        }

        return response()->json([
            'item' => $item->toCustomerPayload(),
        ], 201);
    }
}

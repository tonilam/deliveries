<?php

namespace App\Http\Controllers;

use App\Enums\ItemDisplayUnit;
use App\Http\Requests\StoreItemRequest;
use App\Models\Item;
use Illuminate\Http\JsonResponse;

class CreateItemController extends Controller
{
    public function __invoke(StoreItemRequest $request): JsonResponse
    {
        $item = Item::query()->create([
            'company_id' => $request->user()->company_id,
            'good_type_code' => $request->string('good_type_code')->toString(),
            'weight_tonnes' => $request->input('weight_tonnes'),
            'display_unit' => ItemDisplayUnit::from($request->string('display_unit')->toString()),
            'order_number' => $request->input('order_number'),
            'connote' => $request->input('connote'),
        ]);

        $item->load('goodType');

        return response()->json([
            'item' => $item->toCustomerPayload(),
        ], 201);
    }
}

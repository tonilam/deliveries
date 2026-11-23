<?php

namespace App\Http\Controllers;

use App\Enums\ItemDisplayUnit;
use App\Http\Requests\UpdateItemRequest;
use App\Models\Item;
use Illuminate\Http\JsonResponse;

class UpdateItemController extends Controller
{
    public function __invoke(UpdateItemRequest $request, Item $item): JsonResponse
    {
        $item->update([
            'good_type_code' => $request->string('good_type_code')->toString(),
            'weight_tonnes' => $request->input('weight_tonnes'),
            'quantity' => (int) $request->input('quantity'),
            'display_unit' => ItemDisplayUnit::from($request->string('display_unit')->toString()),
            'order_number' => $request->input('order_number'),
            'connote' => $request->input('connote'),
        ]);

        $item->load('goodType');

        return response()->json([
            'item' => $item->toCustomerPayload(),
        ]);
    }
}

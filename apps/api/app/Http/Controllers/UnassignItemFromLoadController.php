<?php

namespace App\Http\Controllers;

use App\Http\Requests\UnassignItemFromLoadRequest;
use App\Models\Item;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class UnassignItemFromLoadController extends Controller
{
    public function __invoke(UnassignItemFromLoadRequest $request, Load $load, Item $item): JsonResponse
    {
        $item->load_id = null;
        $item->save();

        $item->load('goodType');

        return response()->json([
            'item' => $item->toCustomerPayload(),
        ]);
    }
}

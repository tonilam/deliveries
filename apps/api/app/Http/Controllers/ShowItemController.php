<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManageItemRequest;
use App\Models\Item;
use Illuminate\Http\JsonResponse;

class ShowItemController extends Controller
{
    public function __invoke(ManageItemRequest $request, Item $item): JsonResponse
    {
        $item->load('goodType');

        return response()->json([
            'item' => $item->toCustomerPayload(),
        ]);
    }
}

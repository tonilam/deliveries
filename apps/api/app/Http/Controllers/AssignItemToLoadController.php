<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignItemToLoadRequest;
use App\Models\Item;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class AssignItemToLoadController extends Controller
{
    public function __invoke(AssignItemToLoadRequest $request, Load $load): JsonResponse
    {
        $item = Item::query()
            ->where('company_id', $request->user()->company_id)
            ->whereKey($request->integer('item_id'))
            ->firstOrFail();

        $item->load_id = $load->id;
        $item->save();

        $item->load('goodType');

        return response()->json([
            'item' => $item->toCustomerPayload(),
        ]);
    }
}

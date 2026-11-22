<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManageItemRequest;
use App\Models\Item;
use App\Models\Load;
use App\Services\LoadActivityLogger;
use Illuminate\Http\Response;

class DeleteItemController extends Controller
{
    public function __invoke(ManageItemRequest $request, Item $item, LoadActivityLogger $activityLogger): Response
    {
        $load = null;
        if ($item->load_id !== null) {
            $load = Load::query()
                ->where('company_id', $request->user()->company_id)
                ->whereKey($item->load_id)
                ->first();
        }

        $item->delete();

        if ($load !== null) {
            $activityLogger->itemUnassigned($load, $item, $request->user());
        }

        return response()->noContent();
    }
}

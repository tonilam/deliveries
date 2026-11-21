<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManageItemRequest;
use App\Models\Item;
use Illuminate\Http\Response;

class DeleteItemController extends Controller
{
    public function __invoke(ManageItemRequest $request, Item $item): Response
    {
        $item->delete();

        return response()->noContent();
    }
}

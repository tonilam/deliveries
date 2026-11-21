<?php

namespace App\Http\Controllers;

use App\Http\Requests\ItemGoodTypeOptionsRequest;
use App\Models\GoodType;
use Illuminate\Http\JsonResponse;

class ItemGoodTypeOptionsController extends Controller
{
    public function __invoke(ItemGoodTypeOptionsRequest $request): JsonResponse
    {
        $types = GoodType::query()
            ->orderBy('name')
            ->orderBy('code')
            ->get()
            ->map(static fn (GoodType $type) => $type->toOptionPayload())
            ->values()
            ->all();

        return response()->json([
            'good_types' => $types,
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreGoodTypeRequest;
use App\Models\GoodType;
use Illuminate\Http\JsonResponse;

class CreateGoodTypeController extends Controller
{
    public function __invoke(StoreGoodTypeRequest $request): JsonResponse
    {
        $type = GoodType::query()->create([
            'code' => $request->string('code')->toString(),
            'name' => $request->string('name')->toString(),
            'refrigerated_required' => $request->boolean('refrigerated_required'),
        ]);

        return response()->json([
            'good_type' => $type->toAdminPayload(),
        ], 201);
    }
}

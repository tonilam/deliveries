<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreVehicleCategoryRequest;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class CreateVehicleCategoryController extends Controller
{
    public function __invoke(StoreVehicleCategoryRequest $request): JsonResponse
    {
        $category = VehicleCategory::query()->create([
            'name' => $request->string('name')->toString(),
            'code' => strtolower($request->string('code')->toString()),
            'sort_order' => $request->integer('sort_order', 0),
        ]);

        return response()->json([
            'vehicle_category' => $category->fresh()->toAdminPayload(),
        ], 201);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateVehicleCategoryRequest;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class UpdateVehicleCategoryController extends Controller
{
    public function __invoke(UpdateVehicleCategoryRequest $request, VehicleCategory $vehicleCategory): JsonResponse
    {
        $vehicleCategory->update([
            'name' => $request->string('name')->toString(),
            'code' => strtolower($request->string('code')->toString()),
            'sort_order' => $request->integer('sort_order', $vehicleCategory->sort_order),
        ]);

        $vehicleCategory->loadCount('bodyTypes');

        return response()->json([
            'vehicle_category' => $vehicleCategory->toAdminPayload(),
        ]);
    }
}

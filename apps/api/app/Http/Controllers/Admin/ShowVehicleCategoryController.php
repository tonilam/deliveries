<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class ShowVehicleCategoryController extends Controller
{
    public function __invoke(VehicleCategory $vehicleCategory): JsonResponse
    {
        $vehicleCategory->loadCount('bodyTypes');

        return response()->json([
            'vehicle_category' => $vehicleCategory->toAdminPayload(),
        ]);
    }
}

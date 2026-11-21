<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class ShowVehicleBodyTypeController extends Controller
{
    public function __invoke(VehicleCategory $vehicleCategory, VehicleBodyType $bodyType): JsonResponse
    {
        $bodyType->load('options');

        return response()->json([
            'vehicle_body_type' => $bodyType->toAdminPayload(true),
            'vehicle_category' => $vehicleCategory->toAdminPayload(),
        ]);
    }
}

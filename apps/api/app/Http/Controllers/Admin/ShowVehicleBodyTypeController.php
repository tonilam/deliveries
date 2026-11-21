<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class ShowVehicleBodyTypeController extends Controller
{
    public function __invoke(AdminRequest $request, VehicleCategory $vehicleCategory, VehicleBodyType $bodyType): JsonResponse
    {
        $bodyType->load('options');

        return response()->json([
            'vehicle_body_type' => $bodyType->toAdminPayload(true),
            'vehicle_category' => $vehicleCategory->toAdminPayload(),
        ]);
    }
}

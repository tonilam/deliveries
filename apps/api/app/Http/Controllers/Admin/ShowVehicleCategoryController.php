<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class ShowVehicleCategoryController extends Controller
{
    public function __invoke(AdminRequest $request, VehicleCategory $vehicleCategory): JsonResponse
    {
        $vehicleCategory->loadCount('bodyTypes');

        return response()->json([
            'vehicle_category' => $vehicleCategory->toAdminPayload(),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class DeleteVehicleCategoryController extends Controller
{
    public function __invoke(AdminRequest $request, VehicleCategory $vehicleCategory): Response|JsonResponse
    {
        if ($vehicleCategory->bodyTypes()->exists()) {
            throw ValidationException::withMessages([
                'vehicle_category' => ['This category cannot be deleted while body types still belong to it.'],
            ]);
        }

        $vehicleCategory->delete();

        return response()->noContent();
    }
}

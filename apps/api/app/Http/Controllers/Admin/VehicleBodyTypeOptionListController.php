<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class VehicleBodyTypeOptionListController extends Controller
{
    public function __invoke(VehicleCategory $vehicleCategory, VehicleBodyType $bodyType): JsonResponse
    {
        ShowVehicleBodyTypeController::assertBodyTypeBelongsToCategory($vehicleCategory, $bodyType);

        $options = $bodyType->options()->get();

        return response()->json([
            'options' => $options
                ->map(static fn (VehicleBodyTypeOption $option) => $option->toAdminPayload())
                ->values()
                ->all(),
        ]);
    }
}

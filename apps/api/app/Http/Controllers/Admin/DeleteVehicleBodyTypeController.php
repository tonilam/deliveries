<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Http\Response;

class DeleteVehicleBodyTypeController extends Controller
{
    public function __invoke(VehicleCategory $vehicleCategory, VehicleBodyType $bodyType): Response
    {
        ShowVehicleBodyTypeController::assertBodyTypeBelongsToCategory($vehicleCategory, $bodyType);

        $bodyType->delete();

        return response()->noContent();
    }
}

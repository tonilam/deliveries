<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Http\Response;

class DeleteVehicleBodyTypeController extends Controller
{
    public function __invoke(AdminRequest $request, VehicleCategory $vehicleCategory, VehicleBodyType $bodyType): Response
    {
        $bodyType->delete();

        return response()->noContent();
    }
}

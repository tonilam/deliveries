<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use Illuminate\Http\Response;

class DeleteVehicleBodyTypeOptionController extends Controller
{
    public function __invoke(
        AdminRequest $request,
        VehicleCategory $vehicleCategory,
        VehicleBodyType $bodyType,
        VehicleBodyTypeOption $option,
    ): Response {
        $key = $option->key;
        $option->delete();

        $values = $bodyType->option_values ?? [];
        if (array_key_exists($key, $values)) {
            unset($values[$key]);
            $bodyType->update(['option_values' => $values]);
        }

        return response()->noContent();
    }
}

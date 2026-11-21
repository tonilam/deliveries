<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreVehicleBodyTypeOptionRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class CreateVehicleBodyTypeOptionController extends Controller
{
    public function __invoke(
        StoreVehicleBodyTypeOptionRequest $request,
        VehicleCategory $vehicleCategory,
        VehicleBodyType $bodyType,
    ): JsonResponse {
        /** @var VehicleBodyTypeOption $option */
        $option = $bodyType->options()->create([
            'key' => strtolower($request->string('key')->toString()),
            'label' => $request->string('label')->toString(),
            'data_type' => $request->input('data_type'),
            'visibility' => $request->input('visibility'),
            'required' => $request->boolean('required'),
            'sort_order' => $request->integer('sort_order', 0),
        ]);

        return response()->json([
            'option' => $option->toAdminPayload(),
        ], 201);
    }
}

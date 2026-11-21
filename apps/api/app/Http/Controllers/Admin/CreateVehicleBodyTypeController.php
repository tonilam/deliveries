<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreVehicleBodyTypeRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use App\Services\VehicleBodyTypeOptionValuesValidator;
use Illuminate\Http\JsonResponse;

class CreateVehicleBodyTypeController extends Controller
{
    public function __construct(
        private readonly VehicleBodyTypeOptionValuesValidator $optionValues,
    ) {}

    public function __invoke(StoreVehicleBodyTypeRequest $request, VehicleCategory $vehicleCategory): JsonResponse
    {
        $bodyType = new VehicleBodyType([
            'vehicle_category_id' => $vehicleCategory->id,
            'name' => $request->string('name')->toString(),
            'code' => strtolower($request->string('code')->toString()),
            'capacity' => $request->input('capacity'),
            'capacity_unit' => $request->input('capacity_unit'),
            'pallet_spaces' => $request->input('pallet_spaces'),
            'cubic_metres' => $request->input('cubic_metres'),
            'payload_kg' => $request->input('payload_kg'),
            'description' => $request->input('description'),
            'option_values' => [],
        ]);

        $bodyType->save();
        $bodyType->load('options');

        if ($request->has('option_values')) {
            $normalized = $this->optionValues->validateAndNormalize(
                $bodyType,
                $request->input('option_values'),
            );
            $bodyType->update(['option_values' => $normalized]);
        }

        return response()->json([
            'vehicle_body_type' => $bodyType->fresh()->toAdminPayload(true),
        ], 201);
    }
}

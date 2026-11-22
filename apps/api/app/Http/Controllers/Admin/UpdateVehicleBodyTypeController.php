<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateVehicleBodyTypeRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use App\Services\VehicleBodyTypeOptionValuesValidator;
use Illuminate\Http\JsonResponse;

class UpdateVehicleBodyTypeController extends Controller
{
    public function __construct(
        private readonly VehicleBodyTypeOptionValuesValidator $optionValues,
    ) {}

    public function __invoke(
        UpdateVehicleBodyTypeRequest $request,
        VehicleCategory $vehicleCategory,
        VehicleBodyType $bodyType,
    ): JsonResponse {
        $bodyType->load('options');

        $existing = $bodyType->option_values ?? [];
        $incoming = $request->has('option_values') && is_array($request->input('option_values'))
            ? $request->input('option_values')
            : [];
        $merged = $request->has('option_values')
            ? array_merge($existing, $incoming)
            : $existing;

        $optionValues = $this->optionValues->validateAndNormalize($bodyType, $merged);

        $bodyType->update([
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
            'capacity' => $request->input('capacity'),
            'capacity_unit' => $request->input('capacity_unit'),
            'pallet_spaces' => $request->input('pallet_spaces'),
            'cubic_metres' => $request->input('cubic_metres'),
            'payload_kg' => $request->input('payload_kg'),
            'description' => $request->input('description'),
            'option_values' => $optionValues,
        ]);

        $bodyType->load('options');

        return response()->json([
            'vehicle_body_type' => $bodyType->toAdminPayload(true),
        ]);
    }
}

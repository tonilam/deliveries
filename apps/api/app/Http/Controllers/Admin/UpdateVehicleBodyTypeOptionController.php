<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateVehicleBodyTypeOptionRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use App\Services\VehicleBodyTypeOptionValuesValidator;
use Illuminate\Http\JsonResponse;

class UpdateVehicleBodyTypeOptionController extends Controller
{
    public function __construct(
        private readonly VehicleBodyTypeOptionValuesValidator $optionValues,
    ) {}

    public function __invoke(
        UpdateVehicleBodyTypeOptionRequest $request,
        VehicleCategory $vehicleCategory,
        VehicleBodyType $bodyType,
        VehicleBodyTypeOption $option,
    ): JsonResponse {
        ShowVehicleBodyTypeController::assertBodyTypeBelongsToCategory($vehicleCategory, $bodyType);
        $this->assertOptionBelongsToBodyType($bodyType, $option);

        $oldKey = $option->key;
        $newKey = strtolower($request->string('key')->toString());

        $option->update([
            'key' => $newKey,
            'label' => $request->string('label')->toString(),
            'data_type' => $request->input('data_type'),
            'visibility' => $request->input('visibility'),
            'required' => $request->boolean('required'),
            'sort_order' => $request->integer('sort_order', $option->sort_order),
        ]);

        if ($oldKey !== $newKey) {
            $values = $bodyType->option_values ?? [];
            if (array_key_exists($oldKey, $values)) {
                $values[$newKey] = $values[$oldKey];
                unset($values[$oldKey]);
                $bodyType->update(['option_values' => $values]);
            }
        }

        $bodyType->load('options');
        $normalized = $this->optionValues->validateAndNormalize(
            $bodyType,
            $bodyType->fresh()->option_values ?? [],
        );
        $bodyType->update(['option_values' => $normalized]);

        return response()->json([
            'option' => $option->fresh()->toAdminPayload(),
        ]);
    }

    public static function assertOptionBelongsToBodyType(VehicleBodyType $bodyType, VehicleBodyTypeOption $option): void
    {
        if ($option->vehicle_body_type_id !== $bodyType->id) {
            abort(404);
        }
    }
}

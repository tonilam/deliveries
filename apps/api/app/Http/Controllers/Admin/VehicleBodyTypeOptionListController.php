<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class VehicleBodyTypeOptionListController extends Controller
{
    public function __invoke(AdminRequest $request, VehicleCategory $vehicleCategory, VehicleBodyType $bodyType): JsonResponse
    {
        $options = $bodyType->options()->get();

        return response()->json([
            'options' => $options
                ->map(static fn (VehicleBodyTypeOption $option) => $option->toAdminPayload())
                ->values()
                ->all(),
        ]);
    }
}

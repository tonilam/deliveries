<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateCompanyVehicleBodyTypeRequest;
use App\Models\VehicleBodyType;
use Illuminate\Http\JsonResponse;

class UpdateCompanyVehicleBodyTypeController extends Controller
{
    public function __invoke(UpdateCompanyVehicleBodyTypeRequest $request, VehicleBodyType $bodyType): JsonResponse
    {
        $company = $request->user()->company;
        if ($company === null) {
            abort(403);
        }
        $bodyType->loadMissing('category');
        if ($bodyType->category === null) {
            abort(404);
        }

        if ($request->boolean('active')) {
            $company->vehicleBodyTypes()->syncWithoutDetaching([$bodyType->id]);
            $active = true;
        } else {
            $company->vehicleBodyTypes()->detach($bodyType->id);
            $active = false;
        }

        return response()->json([
            'vehicle_body_type' => $bodyType->toCustomerPayload($active),
        ]);
    }
}

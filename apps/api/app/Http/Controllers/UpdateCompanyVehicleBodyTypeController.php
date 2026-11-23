<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateCompanyVehicleBodyTypeRequest;
use App\Models\User;
use App\Models\VehicleBodyType;
use App\Services\CompanyVehicleActivityLogger;
use Illuminate\Http\JsonResponse;

class UpdateCompanyVehicleBodyTypeController extends Controller
{
    public function __invoke(
        UpdateCompanyVehicleBodyTypeRequest $request,
        VehicleBodyType $bodyType,
        CompanyVehicleActivityLogger $activityLogger,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $company = $user->company;
        if ($company === null) {
            abort(403);
        }
        $bodyType->loadMissing('category');
        if ($bodyType->category === null) {
            abort(404);
        }

        $active = $request->boolean('active');
        $alreadyActive = $company->vehicleBodyTypes()->whereKey($bodyType->id)->exists();
        if ($alreadyActive === $active) {
            return response()->json([
                'vehicle_body_type' => $bodyType->toCustomerPayload($active),
            ]);
        }

        if ($active) {
            $company->vehicleBodyTypes()->syncWithoutDetaching([$bodyType->id]);
            $activityLogger->activated($company, $bodyType, $user);
        } else {
            $company->vehicleBodyTypes()->detach($bodyType->id);
            $activityLogger->deactivated($company, $bodyType, $user);
        }

        return response()->json([
            'vehicle_body_type' => $bodyType->toCustomerPayload($active),
        ]);
    }
}

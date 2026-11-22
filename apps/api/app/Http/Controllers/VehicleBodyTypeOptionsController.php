<?php

namespace App\Http\Controllers;

use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Http\Requests\VehicleBodyTypeOptionsRequest;
use Illuminate\Http\JsonResponse;

class VehicleBodyTypeOptionsController extends Controller
{
    public function __invoke(VehicleBodyTypeOptionsRequest $request): JsonResponse
    {
        $company = $request->user()->company;
        if ($company === null) {
            abort(403);
        }

        $bodyTypes = $company
            ->vehicleBodyTypes()
            ->select([
                'vehicle_body_types.id',
                'vehicle_body_types.vehicle_category_id',
                'vehicle_body_types.name',
                'vehicle_body_types.code',
                'vehicle_body_types.capacity',
                'vehicle_body_types.capacity_unit',
            ])
            ->with([
                'category' => static fn ($query) => $query->select('id', 'name', 'sort_order'),
                'options' => static fn ($query) => $query
                    ->where('visibility', VehicleBodyTypeOptionVisibility::Public)
                    ->orderBy('sort_order')
                    ->orderBy('id'),
            ])
            ->whereHas('category')
            ->get()
            ->sortBy(static fn ($bodyType) => [
                $bodyType->category->sort_order,
                $bodyType->category->id,
                $bodyType->name,
                $bodyType->id,
            ])
            ->values()
            ->map(static fn ($bodyType) => $bodyType->toOptionPayload())
            ->all();

        return response()->json([
            'vehicle_body_types' => $bodyTypes,
        ]);
    }
}

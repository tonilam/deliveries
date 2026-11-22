<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListCustomerVehiclesRequest;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class ListCustomerVehiclesController extends Controller
{
    public function __invoke(ListCustomerVehiclesRequest $request): JsonResponse
    {
        $company = $request->user()->company;
        if ($company === null) {
            abort(403);
        }
        $activeIds = $company
            ->vehicleBodyTypes()
            ->pluck('vehicle_body_types.id')
            ->flip()
            ->all();

        $categories = VehicleCategory::query()
            ->whereHas('bodyTypes')
            ->with([
                'bodyTypes' => static fn ($query) => $query->orderBy('name')->orderBy('id'),
            ])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(static fn (VehicleCategory $category) => $category->toCustomerCataloguePayload($activeIds))
            ->values()
            ->all();

        return response()->json([
            'vehicle_categories' => $categories,
        ]);
    }
}

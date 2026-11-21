<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\AppliesAdminTextListQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListVehicleBodyTypesRequest;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class VehicleBodyTypeListController extends Controller
{
    use AppliesAdminTextListQuery;

    public function __invoke(ListVehicleBodyTypesRequest $request, VehicleCategory $vehicleCategory): JsonResponse
    {
        $query = VehicleBodyType::query()->where('vehicle_category_id', $vehicleCategory->id);
        $this->applyAdminFilters($query, $request->filters());
        $this->applyAdminSearch($query, $request->search(), ['name', 'code', 'capacity_unit']);
        $query->orderBy($request->sort(), $request->direction())->orderBy('id');

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query->paginate($perPage, ['*'], 'page', $page)->withQueryString();

        return response()->json([
            'vehicle_body_types' => collect($paginator->items())
                ->map(static fn (VehicleBodyType $bodyType) => $bodyType->toAdminPayload())
                ->values()
                ->all(),
            'vehicle_category' => $vehicleCategory->toAdminPayload(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }
}

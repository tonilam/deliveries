<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\AppliesAdminTextListQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListVehicleCategoriesRequest;
use App\Models\VehicleCategory;
use Illuminate\Http\JsonResponse;

class VehicleCategoryListController extends Controller
{
    use AppliesAdminTextListQuery;

    public function __invoke(ListVehicleCategoriesRequest $request): JsonResponse
    {
        if ($request->catalogue()) {
            $categories = VehicleCategory::query()
                ->with([
                    'bodyTypes' => static fn ($q) => $q->orderBy('name')->orderBy('id'),
                ])
                ->withCount('bodyTypes')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(static fn (VehicleCategory $category) => $category->toAdminPayload(true))
                ->values()
                ->all();

            return response()->json([
                'vehicle_categories' => $categories,
            ]);
        }

        $query = VehicleCategory::query();
        $this->applyAdminFilters($query, $request->filters());
        $this->applyAdminSearch($query, $request->search(), ['name', 'code']);
        $query->orderBy($request->sort(), $request->direction())->orderBy('id');

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->withCount('bodyTypes')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'vehicle_categories' => collect($paginator->items())
                ->map(static fn (VehicleCategory $category) => $category->toAdminPayload())
                ->values()
                ->all(),
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

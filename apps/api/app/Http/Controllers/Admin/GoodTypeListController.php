<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\AppliesAdminTextListQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListGoodTypesRequest;
use App\Models\GoodType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class GoodTypeListController extends Controller
{
    use AppliesAdminTextListQuery;

    public function __invoke(ListGoodTypesRequest $request): JsonResponse
    {
        $query = GoodType::query();

        $this->applyFilters($query, $request->filters());
        $this->applyAdminSearch($query, $request->search(), ['code', 'name']);
        $query->orderBy($request->sort(), $request->direction())->orderBy('code');

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'good_types' => collect($paginator->items())
                ->map(static fn (GoodType $type) => $type->toAdminPayload())
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

    /**
     * @param  Builder<GoodType>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            if ($column === 'refrigerated_required') {
                $this->applyRefrigeratedFilter($query, $filter['type'], $filter['filter']);

                continue;
            }

            $this->applyAdminColumnFilter($query, $column, $filter['type'], $filter['filter']);
        }
    }

    /**
     * @param  Builder<GoodType>  $query
     */
    private function applyRefrigeratedFilter(Builder $query, string $type, ?string $value): void
    {
        $displayExpr = "CASE WHEN refrigerated_required THEN 'Yes' ELSE 'No' END";

        if ($type === 'blank') {
            $query->whereNull('refrigerated_required');

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('refrigerated_required');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        if (trim($value) === '__no_match__') {
            $query->whereRaw('0 = 1');

            return;
        }

        $required = $this->parseRefrigeratedFilterValue($value);
        $like = $this->escapeLikeForList($value);

        if ($required !== null) {
            if (in_array($type, ['equals', 'contains', 'startsWith', 'endsWith'], true)) {
                $query->where('refrigerated_required', $required);

                return;
            }

            if (in_array($type, ['notEqual', 'notContains'], true)) {
                $query->where('refrigerated_required', '!=', $required);

                return;
            }
        }

        match ($type) {
            'equals' => $query->whereRaw("{$displayExpr} = ?", [$value]),
            'notEqual' => $query->whereRaw("{$displayExpr} != ?", [$value]),
            'contains' => $query->whereRaw("{$displayExpr} LIKE ?", ['%'.$like.'%']),
            'notContains' => $query->whereRaw("{$displayExpr} NOT LIKE ?", ['%'.$like.'%']),
            'startsWith' => $query->whereRaw("{$displayExpr} LIKE ?", [$like.'%']),
            'endsWith' => $query->whereRaw("{$displayExpr} LIKE ?", ['%'.$like]),
            default => null,
        };
    }

    private function parseRefrigeratedFilterValue(string $value): ?bool
    {
        return match (strtolower(trim($value))) {
            'yes', 'true', '1', 'y' => true,
            'no', 'false', '0', 'n' => false,
            default => null,
        };
    }
}

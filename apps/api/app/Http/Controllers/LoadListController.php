<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\ListLoadsRequest;
use App\Models\Company;
use App\Models\Load;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class LoadListController extends Controller
{
    public function __invoke(ListLoadsRequest $request): JsonResponse
    {
        $user = $request->user();
        $ownerType = Company::query()->whereKey($user->company_id)->value('company_type');

        $query = Load::query()
            ->where('loads.company_id', $user->company_id)
            ->where('loads.type', LoadType::Direct)
            ->whereNull('loads.parent_load_id');

        $this->applyListJoins($query);
        $this->applyFilters($query, $request->filters());
        $this->applySearch($query, $request->search());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count('loads.id');
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->select('loads.*')
            ->with([
                'children' => static function ($childQuery): void {
                    $childQuery->with([
                        'customerCompany:id,business_name',
                        'providerCompany:id,business_name',
                        'secondaryProviderCompany:id,business_name',
                        'collectionAddress',
                        'deliveryAddress',
                        'xdockAddress',
                    ])->withCount('items');
                },
            ])
            ->withCount('items')
            ->paginate($perPage, ['loads.*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'loads' => collect($paginator->items())
                ->map(static fn (Load $load) => $load->toCustomerPayload(true))
                ->values()
                ->all(),
            'meta' => [
                'own_company_type' => $ownerType?->value,
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
     * @param  Builder<Load>  $query
     */
    private function applyListJoins(Builder $query): void
    {
        $query->leftJoin('companies as load_customer', 'loads.customer_company_id', '=', 'load_customer.id')
            ->leftJoin('companies as load_provider', 'loads.provider_company_id', '=', 'load_provider.id')
            ->leftJoin('addresses as load_collection', 'loads.collection_address_id', '=', 'load_collection.id')
            ->leftJoin('addresses as load_delivery', 'loads.delivery_address_id', '=', 'load_delivery.id');
    }

    /**
     * @param  Builder<Load>  $query
     */
    private function applySearch(Builder $query, ?string $search): void
    {
        if ($search === null) {
            return;
        }

        $like = '%'.$this->escapeLike($search).'%';

        $query->where(function (Builder $inner) use ($like): void {
            $inner->where('load_customer.business_name', 'like', $like)
                ->orWhere('load_provider.business_name', 'like', $like)
                ->orWhere('load_collection.business_name', 'like', $like)
                ->orWhere('load_collection.address', 'like', $like)
                ->orWhere('load_delivery.business_name', 'like', $like)
                ->orWhere('load_delivery.address', 'like', $like)
                ->orWhere('loads.pallet_count', 'like', $like)
                ->orWhere('loads.pickup_date', 'like', $like)
                ->orWhere('loads.pickup_time', 'like', $like)
                ->orWhere('loads.dropoff_date', 'like', $like)
                ->orWhere('loads.dropoff_time', 'like', $like);
        });
    }

    /**
     * @param  Builder<Load>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'item_count') {
            $sqlDirection = strtolower($direction) === 'desc' ? 'DESC' : 'ASC';
            $query->withCount('items')
                ->orderByRaw(
                    '(COALESCE(items_count, 0) + COALESCE((SELECT COUNT(*) FROM items '
                    .'INNER JOIN loads AS child_loads ON child_loads.id = items.load_id '
                    .'WHERE child_loads.parent_load_id = loads.id), 0)) '.$sqlDirection
                )
                ->orderBy('loads.id');

            return;
        }

        if ($sort === 'pickup_date') {
            $query->orderBy('loads.pickup_date', $direction)
                ->orderBy('loads.pickup_time', $direction)
                ->orderBy('loads.id');

            return;
        }

        if ($sort === 'pickup_time') {
            $query->orderBy('loads.pickup_time', $direction)
                ->orderBy('loads.pickup_date', $direction)
                ->orderBy('loads.id');

            return;
        }

        if ($sort === 'dropoff_date') {
            $query->orderBy('loads.dropoff_date', $direction)
                ->orderBy('loads.dropoff_time', $direction)
                ->orderBy('loads.id');

            return;
        }

        if ($sort === 'dropoff_time') {
            $query->orderBy('loads.dropoff_time', $direction)
                ->orderBy('loads.dropoff_date', $direction)
                ->orderBy('loads.id');

            return;
        }

        $column = match ($sort) {
            'id' => 'loads.id',
            'customer' => 'load_customer.business_name',
            'provider' => 'load_provider.business_name',
            'collection' => 'load_collection.business_name',
            'delivery' => 'load_delivery.business_name',
            'pallet_count' => 'loads.pallet_count',
            default => 'load_customer.business_name',
        };

        $query->orderBy($column, $direction)->orderBy('loads.id');
    }

    /**
     * @param  Builder<Load>  $query
     * @param  array<string, array{type: string, filter: ?string, filterTo?: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $this->applyColumnFilter(
                $query,
                $column,
                $filter['type'],
                $filter['filter'],
                $filter['filterTo'] ?? null,
            );
        }
    }

    /**
     * @param  Builder<Load>  $query
     */
    private function applyColumnFilter(
        Builder $query,
        string $column,
        string $type,
        ?string $value,
        ?string $filterTo = null,
    ): void {
        $dbColumn = match ($column) {
            'id' => 'loads.id',
            'customer' => 'load_customer.business_name',
            'provider' => 'load_provider.business_name',
            'collection' => 'load_collection.business_name',
            'delivery' => 'load_delivery.business_name',
            'pickup_date' => 'loads.pickup_date',
            'pickup_time' => 'loads.pickup_time',
            'dropoff_date' => 'loads.dropoff_date',
            'dropoff_time' => 'loads.dropoff_time',
            'pallet_count' => 'loads.pallet_count',
            default => null,
        };

        if ($dbColumn === null) {
            return;
        }

        if (in_array($column, ['pickup_date', 'dropoff_date'], true) && $this->usesDateComparison($type)) {
            $this->applyDateFilter($query, $dbColumn, $type, $value, $filterTo);

            return;
        }

        if (in_array($column, ['id', 'pallet_count'], true) && $this->usesNumericComparison($type)) {
            $this->applyNumericFilter($query, $dbColumn, $type, $value, $filterTo);

            return;
        }

        if ($type === 'blank') {
            $query->where(function (Builder $inner) use ($dbColumn): void {
                $inner->whereNull($dbColumn)->orWhere($dbColumn, '');
            });

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull($dbColumn)->where($dbColumn, '!=', '');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->where($dbColumn, $value),
            'notEqual' => $query->where($dbColumn, '!=', $value),
            'contains' => $query->where($dbColumn, 'like', '%'.$like.'%'),
            'notContains' => $query->where(function (Builder $inner) use ($dbColumn, $like): void {
                $inner->whereNull($dbColumn)
                    ->orWhere($dbColumn, 'not like', '%'.$like.'%');
            }),
            'startsWith' => $query->where($dbColumn, 'like', $like.'%'),
            'endsWith' => $query->where($dbColumn, 'like', '%'.$like),
            default => null,
        };
    }

    /**
     * @param  Builder<Load>  $query
     */
    private function applyDateFilter(
        Builder $query,
        string $dbColumn,
        string $type,
        ?string $value,
        ?string $filterTo,
    ): void {
        if ($type === 'inRange') {
            $from = $this->normalizeFilterDate($value);
            $to = $this->normalizeFilterDate($filterTo);
            if ($from === null || $to === null) {
                return;
            }

            $query->where($dbColumn, '>=', $from)
                ->where($dbColumn, '<=', $to);

            return;
        }

        $bound = $this->normalizeFilterDate($value);
        if ($bound === null) {
            return;
        }

        match ($type) {
            'equals' => $query->where($dbColumn, '=', $bound),
            'notEqual' => $query->where($dbColumn, '!=', $bound),
            'greaterThan' => $query->where($dbColumn, '>', $bound),
            'greaterThanOrEqual' => $query->where($dbColumn, '>=', $bound),
            'lessThan' => $query->where($dbColumn, '<', $bound),
            'lessThanOrEqual' => $query->where($dbColumn, '<=', $bound),
            default => null,
        };
    }

    private function normalizeFilterDate(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (strlen($value) < 10 || ! preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            return null;
        }

        return substr($value, 0, 10);
    }

    private function usesDateComparison(string $type): bool
    {
        return in_array($type, [
            'equals',
            'notEqual',
            'greaterThan',
            'lessThan',
            'greaterThanOrEqual',
            'lessThanOrEqual',
            'inRange',
        ], true);
    }

    private function applyNumericFilter(
        Builder $query,
        string $dbColumn,
        string $type,
        ?string $value,
        ?string $filterTo,
    ): void {
        if ($type === 'inRange') {
            if ($value === null || $value === '' || $filterTo === null || $filterTo === '') {
                return;
            }

            $query->where($dbColumn, '>=', (int) $value)
                ->where($dbColumn, '<=', (int) $filterTo);

            return;
        }

        if ($value === null || $value === '' || ! is_numeric($value)) {
            return;
        }

        $bound = (int) $value;

        match ($type) {
            'equals' => $query->where($dbColumn, '=', $bound),
            'notEqual' => $query->where($dbColumn, '!=', $bound),
            'greaterThan' => $query->where($dbColumn, '>', $bound),
            'greaterThanOrEqual' => $query->where($dbColumn, '>=', $bound),
            'lessThan' => $query->where($dbColumn, '<', $bound),
            'lessThanOrEqual' => $query->where($dbColumn, '<=', $bound),
            default => null,
        };
    }

    private function usesNumericComparison(string $type): bool
    {
        return in_array($type, [
            'equals',
            'notEqual',
            'greaterThan',
            'lessThan',
            'greaterThanOrEqual',
            'lessThanOrEqual',
            'inRange',
        ], true);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}

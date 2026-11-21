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
                ->orWhere('loads.pallet_count', 'like', $like);
        });
    }

    /**
     * @param  Builder<Load>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'item_count') {
            $query->withCount('items')
                ->orderBy('items_count', $direction)
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
            'pallet_count' => 'loads.pallet_count',
            default => null,
        };

        if ($dbColumn === null) {
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

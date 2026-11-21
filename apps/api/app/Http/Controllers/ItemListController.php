<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListItemsRequest;
use App\Models\Item;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class ItemListController extends Controller
{
    public function __invoke(ListItemsRequest $request): JsonResponse
    {
        $user = $request->user();

        $query = Item::query()
            ->with('goodType')
            ->where('items.company_id', $user->company_id);

        if ($request->boolean('unassigned')) {
            $query->whereNull('items.load_id');
        } elseif ($request->filled('load_id')) {
            $query->where('items.load_id', (int) $request->input('load_id'));
        }

        $this->applyFilters($query, $request->filters());
        $this->applySearch($query, $request->search());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->paginate($perPage, ['items.*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'items' => collect($paginator->items())
                ->map(static fn (Item $item) => $item->toCustomerPayload())
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
     * @param  Builder<Item>  $query
     */
    private function applySearch(Builder $query, ?string $search): void
    {
        if ($search === null) {
            return;
        }

        $like = '%'.$this->escapeLike($search).'%';

        $this->joinGoodTypesForQuery($query);

        $query->where(function (Builder $inner) use ($like, $search): void {
            $inner->where('good_types.name', 'like', $like)
                ->orWhere('items.good_type_code', 'like', $like)
                ->orWhere('items.display_unit', 'like', $like)
                ->orWhere('items.order_number', 'like', $like)
                ->orWhere('items.connote', 'like', $like)
                ->orWhere('items.weight_tonnes', 'like', $like);

            if (is_numeric($search)) {
                $value = (float) $search;
                $inner->orWhere('items.weight_tonnes', $value)
                    ->orWhere('items.weight_tonnes', $value / 1000);
            }
        });
    }

    /**
     * @param  Builder<Item>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'good_type') {
            $this->joinGoodTypesForQuery($query);
            $query->orderBy('good_types.name', $direction)->orderBy('items.id');

            return;
        }

        $query->orderBy('items.'.$sort, $direction)->orderBy('items.id');
    }

    /**
     * @param  Builder<Item>  $query
     * @param  array<string, array{type: string, filter: ?string, filterTo?: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $filterTo = $filter['filterTo'] ?? null;
            $this->applyColumnFilter($query, $column, $filter['type'], $filter['filter'], $filterTo);
        }
    }

    /**
     * @param  Builder<Item>  $query
     */
    private function applyColumnFilter(
        Builder $query,
        string $column,
        string $type,
        ?string $value,
        ?string $filterTo = null,
    ): void {
        if ($column === 'good_type') {
            $this->applyGoodTypeFilter($query, $type, $value);

            return;
        }

        if ($column === 'weight_tonnes' && $this->usesNumericComparison($type)) {
            $this->applyWeightNumericFilter($query, $type, $value, $filterTo);

            return;
        }

        $dbColumn = 'items.'.$column;

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
     * @param  Builder<Item>  $query
     */
    private function applyGoodTypeFilter(Builder $query, string $type, ?string $value): void
    {
        $this->joinGoodTypesForQuery($query);

        if ($type === 'blank') {
            $query->where(function (Builder $inner): void {
                $inner->whereNull('items.good_type_code')->orWhere('items.good_type_code', '');
            });

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('items.good_type_code')->where('items.good_type_code', '!=', '');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->where(function (Builder $inner) use ($value): void {
                $inner->where('good_types.name', $value)
                    ->orWhere('items.good_type_code', $value);
            }),
            'notEqual' => $query->where(function (Builder $inner) use ($value): void {
                $inner->where('good_types.name', '!=', $value)
                    ->where('items.good_type_code', '!=', $value);
            }),
            'contains' => $query->where(function (Builder $inner) use ($like): void {
                $inner->where('good_types.name', 'like', '%'.$like.'%')
                    ->orWhere('items.good_type_code', 'like', '%'.$like.'%');
            }),
            'notContains' => $query->where(function (Builder $inner) use ($like): void {
                $inner->where(function (Builder $name) use ($like): void {
                    $name->whereNull('good_types.name')
                        ->orWhere('good_types.name', 'not like', '%'.$like.'%');
                })->where('items.good_type_code', 'not like', '%'.$like.'%');
            }),
            'startsWith' => $query->where(function (Builder $inner) use ($like): void {
                $inner->where('good_types.name', 'like', $like.'%')
                    ->orWhere('items.good_type_code', 'like', $like.'%');
            }),
            'endsWith' => $query->where(function (Builder $inner) use ($like): void {
                $inner->where('good_types.name', 'like', '%'.$like)
                    ->orWhere('items.good_type_code', 'like', '%'.$like);
            }),
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

    /**
     * @param  Builder<Item>  $query
     */
    private function applyWeightNumericFilter(
        Builder $query,
        string $type,
        ?string $value,
        ?string $filterTo,
    ): void {
        if ($type === 'inRange') {
            if ($value === null || $value === '' || $filterTo === null || $filterTo === '') {
                return;
            }

            $from = (float) $value;
            $to = (float) $filterTo;
            $query->where('items.weight_tonnes', '>=', $from)
                ->where('items.weight_tonnes', '<=', $to);

            return;
        }

        if ($value === null || $value === '' || ! is_numeric($value)) {
            return;
        }

        $bound = (float) $value;

        match ($type) {
            'equals' => $query->where('items.weight_tonnes', '=', $bound),
            'notEqual' => $query->where('items.weight_tonnes', '!=', $bound),
            'greaterThan' => $query->where('items.weight_tonnes', '>', $bound),
            'greaterThanOrEqual' => $query->where('items.weight_tonnes', '>=', $bound),
            'lessThan' => $query->where('items.weight_tonnes', '<', $bound),
            'lessThanOrEqual' => $query->where('items.weight_tonnes', '<=', $bound),
            default => null,
        };
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    /**
     * @param  Builder<Item>  $query
     */
    private function joinGoodTypesForQuery(Builder $query): void
    {
        if (! $this->queryHasGoodTypeJoin($query)) {
            $query->leftJoin('good_types', 'items.good_type_code', '=', 'good_types.code');
        }
    }

    /**
     * @param  Builder<Item>  $query
     */
    private function queryHasGoodTypeJoin(Builder $query): bool
    {
        $joins = $query->getQuery()->joins ?? [];

        foreach ($joins as $join) {
            if ($join->table === 'good_types') {
                return true;
            }
        }

        return false;
    }
}

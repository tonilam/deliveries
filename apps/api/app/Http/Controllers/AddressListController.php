<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListAddressesRequest;
use App\Models\Address;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AddressListController extends Controller
{
    public function __invoke(ListAddressesRequest $request): JsonResponse
    {
        $user = $request->user();

        $query = Address::query()
            ->with('zone')
            ->where('company_id', $user->company_id);
        $this->applyFilters($query, $request->filters());
        $this->applySearch($query, $request->search());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->paginate($perPage, ['addresses.id', 'addresses.type', 'addresses.business_name', 'addresses.address', 'addresses.zone_id', 'addresses.state', 'addresses.postcode'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'addresses' => collect($paginator->items())
                ->map(static fn (Address $address) => $address->toCustomerPayload())
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
     * Free-text search across address list columns (compact/mobile list).
     *
     * @param  Builder<Address>  $query
     */
    private function applySearch(Builder $query, ?string $search): void
    {
        if ($search === null) {
            return;
        }

        $like = '%'.$this->escapeLike($search).'%';
        $displayExpr = "CASE type WHEN 'collection' THEN 'Collection' WHEN 'delivery' THEN 'Delivery' ELSE '' END";

        $query->where(function (Builder $inner) use ($like, $displayExpr): void {
            $inner->where('business_name', 'like', $like)
                ->orWhere('address', 'like', $like)
                ->orWhere('state', 'like', $like)
                ->orWhere('postcode', 'like', $like)
                ->orWhere('type', 'like', $like)
                ->orWhereRaw("{$displayExpr} LIKE ?", [$like])
                ->orWhereHas('zone', static fn (Builder $zoneQuery) => $zoneQuery->where('name', 'like', $like));
        });
    }

    /**
     * @param  Builder<Address>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'zone') {
            $this->joinZonesForQuery($query);
            $query->orderBy('zones.name', $direction)->orderBy('addresses.id');

            return;
        }

        $query->orderBy($sort, $direction)->orderBy('addresses.id');
    }

    /**
     * @param  Builder<Address>  $query
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
     * @param  Builder<Address>  $query
     */
    private function applyColumnFilter(
        Builder $query,
        string $column,
        string $type,
        ?string $value,
        ?string $filterTo = null,
    ): void {
        if ($column === 'type') {
            $this->applyTypeFilter($query, $type, $value);

            return;
        }

        if ($column === 'zone') {
            $this->applyZoneFilter($query, $type, $value);

            return;
        }

        if ($column === 'postcode' && $this->usesPostcodeNumericComparison($type)) {
            $this->applyPostcodeNumericFilter($query, $type, $value, $filterTo);

            return;
        }

        if ($type === 'blank') {
            $query->where(function (Builder $inner) use ($column): void {
                $inner->whereNull($column)->orWhere($column, '');
            });

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull($column)->where($column, '!=', '');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->where($column, $value),
            'notEqual' => $query->where($column, '!=', $value),
            'contains' => $query->where($column, 'like', '%'.$like.'%'),
            'notContains' => $query->where(function (Builder $inner) use ($column, $like): void {
                $inner->whereNull($column)
                    ->orWhere($column, 'not like', '%'.$like.'%');
            }),
            'startsWith' => $query->where($column, 'like', $like.'%'),
            'endsWith' => $query->where($column, 'like', '%'.$like),
            default => null,
        };
    }

    /**
     * Match against stored enum values and display labels (Collection / Delivery).
     *
     * @param  Builder<Address>  $query
     */
    private function applyTypeFilter(Builder $query, string $type, ?string $value): void
    {
        $displayExpr = "CASE type WHEN 'collection' THEN 'Collection' WHEN 'delivery' THEN 'Delivery' ELSE '' END";

        if ($type === 'blank') {
            $query->where(function (Builder $inner): void {
                $inner->whereNull('type')->orWhere('type', '');
            });

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('type')->where('type', '!=', '');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->where(function (Builder $inner) use ($value, $displayExpr): void {
                $inner->where('type', strtolower(trim($value)))
                    ->orWhereRaw("{$displayExpr} = ?", [$value]);
            }),
            'notEqual' => $query->where(function (Builder $inner) use ($value, $displayExpr): void {
                $inner->where('type', '!=', strtolower(trim($value)))
                    ->whereRaw("{$displayExpr} != ?", [$value]);
            }),
            'contains' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('type', 'like', '%'.$like.'%')
                    ->orWhereRaw("{$displayExpr} LIKE ?", ['%'.$like.'%']);
            }),
            'notContains' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('type', 'not like', '%'.$like.'%')
                    ->whereRaw("{$displayExpr} NOT LIKE ?", ['%'.$like.'%']);
            }),
            'startsWith' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('type', 'like', $like.'%')
                    ->orWhereRaw("{$displayExpr} LIKE ?", [$like.'%']);
            }),
            'endsWith' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('type', 'like', '%'.$like)
                    ->orWhereRaw("{$displayExpr} LIKE ?", ['%'.$like]);
            }),
            default => null,
        };
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    /**
     * @param  Builder<Address>  $query
     */
    private function joinZonesForQuery(Builder $query): void
    {
        if (! $this->queryHasZoneJoin($query)) {
            $query->leftJoin('zones', 'addresses.zone_id', '=', 'zones.id');
        }
    }

    /**
     * @param  Builder<Address>  $query
     */
    private function queryHasZoneJoin(Builder $query): bool
    {
        $joins = $query->getQuery()->joins ?? [];

        foreach ($joins as $join) {
            if ($join->table === 'zones') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  Builder<Address>  $query
     */
    private function applyZoneFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank') {
            $query->whereNull('addresses.zone_id');

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('addresses.zone_id');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $this->joinZonesForQuery($query);
        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->where('zones.name', $value),
            'notEqual' => $query->where(function (Builder $inner) use ($value): void {
                $inner->whereNull('zones.name')->orWhere('zones.name', '!=', $value);
            }),
            'contains' => $query->where('zones.name', 'like', '%'.$like.'%'),
            'notContains' => $query->where(function (Builder $inner) use ($like): void {
                $inner->whereNull('zones.name')
                    ->orWhere('zones.name', 'not like', '%'.$like.'%');
            }),
            'startsWith' => $query->where('zones.name', 'like', $like.'%'),
            'endsWith' => $query->where('zones.name', 'like', '%'.$like),
            default => null,
        };
    }

    private function usesPostcodeNumericComparison(string $type): bool
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
     * Compare postcodes numerically (values are stored as strings).
     *
     * @param  Builder<Address>  $query
     */
    private function applyPostcodeNumericFilter(
        Builder $query,
        string $type,
        ?string $value,
        ?string $filterTo,
    ): void {
        if ($type === 'inRange') {
            if ($value === null || $value === '' || $filterTo === null || $filterTo === '') {
                return;
            }

            $from = (int) $value;
            $to = (int) $filterTo;
            $numericPostcode = $this->postcodeNumericSqlExpression();
            $query->whereRaw("{$numericPostcode} >= ?", [$from])
                ->whereRaw("{$numericPostcode} <= ?", [$to]);

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $bound = (int) $value;
        $numericPostcode = $this->postcodeNumericSqlExpression();

        match ($type) {
            'equals' => $query->whereRaw("{$numericPostcode} = ?", [$bound]),
            'notEqual' => $query->whereRaw("{$numericPostcode} != ?", [$bound]),
            'greaterThan' => $query->whereRaw("{$numericPostcode} > ?", [$bound]),
            'greaterThanOrEqual' => $query->whereRaw("{$numericPostcode} >= ?", [$bound]),
            'lessThan' => $query->whereRaw("{$numericPostcode} < ?", [$bound]),
            'lessThanOrEqual' => $query->whereRaw("{$numericPostcode} <= ?", [$bound]),
            default => null,
        };
    }

    /** @return string SQL fragment comparing postcode numerically (driver-specific CAST). */
    private function postcodeNumericSqlExpression(): string
    {
        return match (DB::connection()->getDriverName()) {
            'mysql', 'mariadb' => 'CAST(postcode AS UNSIGNED)',
            'pgsql' => 'CAST(postcode AS INTEGER)',
            default => 'CAST(postcode AS INTEGER)',
        };
    }
}

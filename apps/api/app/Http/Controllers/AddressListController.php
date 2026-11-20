<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListAddressesRequest;
use App\Models\Address;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class AddressListController extends Controller
{
    public function __invoke(ListAddressesRequest $request): JsonResponse
    {
        $user = $request->user();

        $query = Address::query()->where('company_id', $user->company_id);
        $this->applyFilters($query, $request->filters());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->paginate($perPage, ['id', 'type', 'business_name', 'address', 'zone', 'state', 'postcode'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'addresses' => $paginator->items(),
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
     * @param  Builder<Address>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        $query->orderBy($sort, $direction)->orderBy('id');
    }

    /**
     * @param  Builder<Address>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $this->applyColumnFilter($query, $column, $filter['type'], $filter['filter']);
        }
    }

    /**
     * @param  Builder<Address>  $query
     */
    private function applyColumnFilter(Builder $query, string $column, string $type, ?string $value): void
    {
        if ($column === 'type') {
            $this->applyTypeFilter($query, $type, $value);

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
}

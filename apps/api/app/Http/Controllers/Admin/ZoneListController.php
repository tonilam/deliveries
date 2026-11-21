<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\AppliesAdminTextListQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListZonesRequest;
use App\Models\Country;
use App\Models\Zone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class ZoneListController extends Controller
{
    use AppliesAdminTextListQuery;

    public function __invoke(ListZonesRequest $request): JsonResponse
    {
        $query = Zone::query();

        $this->applyFilters($query, $request->filters());
        $this->applySearch($query, $request->search());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->with(['country' => static fn ($q) => $q->select('id', 'name', 'code')])
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'zones' => collect($paginator->items())
                ->map(static fn (Zone $zone) => $zone->toAdminPayload())
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
     * @param  Builder<Zone>  $query
     */
    private function applySearch(Builder $query, ?string $search): void
    {
        if ($search === null) {
            return;
        }

        $like = '%'.$this->escapeLikeForList($search).'%';

        $query->where(function (Builder $inner) use ($like): void {
            $inner->where('name', 'like', $like)
                ->orWhere('code', 'like', $like)
                ->orWhereHas(
                    'country',
                    fn (Builder $country) => $country->where('name', 'like', $like)
                        ->orWhere('code', 'like', $like),
                );
        });
    }

    /**
     * @param  Builder<Zone>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'country') {
            $query->orderBy(
                Country::query()
                    ->select('name')
                    ->whereColumn('countries.id', 'zones.country_id')
                    ->limit(1),
                $direction,
            )->orderBy('zones.id');

            return;
        }

        $query->orderBy($sort, $direction)->orderBy('id');
    }

    /**
     * @param  Builder<Zone>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            if ($column === 'country') {
                $this->applyCountryFilter($query, $filter['type'], $filter['filter']);

                continue;
            }

            if ($column === 'is_active') {
                $this->applyActiveFilter($query, $filter['type'], $filter['filter']);

                continue;
            }

            $this->applyAdminColumnFilter($query, $column, $filter['type'], $filter['filter']);
        }
    }

    /**
     * @param  Builder<Zone>  $query
     */
    private function applyCountryFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank') {
            $query->whereNull('country_id');

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('country_id');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLikeForList($value);

        $apply = static function (Builder $country, string $filterType, string $needle) use ($value): void {
            match ($filterType) {
                'equals' => $country->where('name', $value)->orWhere('code', $value),
                'notEqual' => $country->where('name', '!=', $value)->where('code', '!=', $value),
                'contains' => $country->where('name', 'like', '%'.$needle.'%')
                    ->orWhere('code', 'like', '%'.$needle.'%'),
                'notContains' => $country->where('name', 'not like', '%'.$needle.'%')
                    ->where('code', 'not like', '%'.$needle.'%'),
                'startsWith' => $country->where('name', 'like', $needle.'%')
                    ->orWhere('code', 'like', $needle.'%'),
                'endsWith' => $country->where('name', 'like', '%'.$needle)
                    ->orWhere('code', 'like', '%'.$needle),
                default => null,
            };
        };

        match ($type) {
            'equals', 'notEqual', 'contains', 'notContains', 'startsWith', 'endsWith' => $query->whereHas(
                'country',
                fn (Builder $country) => $apply($country, $type, $like),
            ),
            default => null,
        };
    }

    /**
     * @param  Builder<Zone>  $query
     */
    private function applyActiveFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank' || $type === 'notBlank') {
            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $active = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($active === null) {
            if (strcasecmp($value, 'active') === 0 || strcasecmp($value, 'yes') === 0) {
                $active = true;
            } elseif (strcasecmp($value, 'inactive') === 0 || strcasecmp($value, 'no') === 0) {
                $active = false;
            } else {
                return;
            }
        }

        match ($type) {
            'equals' => $query->where('is_active', $active),
            'notEqual' => $query->where('is_active', '!=', $active),
            default => null,
        };
    }
}

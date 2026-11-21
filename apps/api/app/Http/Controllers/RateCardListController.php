<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListRateCardsRequest;
use App\Models\RateCard;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class RateCardListController extends Controller
{
    public function __invoke(ListRateCardsRequest $request): JsonResponse
    {
        $user = $request->user();

        $query = RateCard::query()->where('company_id', $user->company_id);
        $this->applyFilters($query, $request->filters());
        $this->applySearch($query, $request->search());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->with([
                'restrictedCompanies' => static fn ($companyQuery) => $companyQuery
                    ->select('companies.id', 'companies.business_name')
                    ->orderBy('companies.business_name'),
            ])
            ->paginate($perPage, ['rate_cards.*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'rate_cards' => collect($paginator->items())
                ->map(static fn (RateCard $rateCard) => $rateCard->toListPayload())
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
     * @param  Builder<RateCard>  $query
     */
    private function applySearch(Builder $query, ?string $search): void
    {
        if ($search === null) {
            return;
        }

        $like = '%'.$this->escapeLike($search).'%';
        $typeExpr = "CASE user_type WHEN 'customer' THEN 'Customer' WHEN 'provider' THEN 'Provider' ELSE '' END";
        $activeExpr = "CASE WHEN is_active THEN 'Yes' ELSE 'No' END";

        $query->where(function (Builder $inner) use ($like, $typeExpr, $activeExpr): void {
            $inner->where('profile_name', 'like', $like)
                ->orWhere('user_type', 'like', $like)
                ->orWhereRaw("{$typeExpr} LIKE ?", [$like])
                ->orWhereRaw("{$activeExpr} LIKE ?", [$like]);

            if (strcasecmp($search, 'yes') === 0 || strcasecmp($search, 'active') === 0) {
                $inner->orWhere('is_active', true);
            }
            if (strcasecmp($search, 'no') === 0 || strcasecmp($search, 'inactive') === 0) {
                $inner->orWhere('is_active', false);
            }

            $inner->orWhereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', 'like', $like),
            );
        });
    }

    /**
     * @param  Builder<RateCard>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        $query->orderBy($sort, $direction)->orderBy('rate_cards.id');
    }

    /**
     * @param  Builder<RateCard>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $this->applyColumnFilter($query, $column, $filter['type'], $filter['filter']);
        }
    }

    /**
     * @param  Builder<RateCard>  $query
     */
    private function applyColumnFilter(
        Builder $query,
        string $column,
        string $type,
        ?string $value,
    ): void {
        if ($column === 'user_type') {
            $this->applyUserTypeFilter($query, $type, $value);

            return;
        }

        if ($column === 'is_active') {
            $this->applyIsActiveFilter($query, $type, $value);

            return;
        }

        if ($column === 'linked_companies') {
            $this->applyLinkedCompaniesFilter($query, $type, $value);

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
     * @param  Builder<RateCard>  $query
     */
    private function applyUserTypeFilter(Builder $query, string $type, ?string $value): void
    {
        $displayExpr = "CASE user_type WHEN 'customer' THEN 'Customer' WHEN 'provider' THEN 'Provider' ELSE '' END";

        if ($type === 'blank') {
            $query->where(function (Builder $inner): void {
                $inner->whereNull('user_type')->orWhere('user_type', '');
            });

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('user_type')->where('user_type', '!=', '');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);
        $normalized = strtolower(trim($value));

        match ($type) {
            'equals' => $query->where(function (Builder $inner) use ($normalized, $value, $displayExpr): void {
                $inner->where('user_type', $normalized)
                    ->orWhereRaw("{$displayExpr} = ?", [$value]);
            }),
            'notEqual' => $query->where(function (Builder $inner) use ($normalized, $value, $displayExpr): void {
                $inner->where('user_type', '!=', $normalized)
                    ->whereRaw("{$displayExpr} != ?", [$value]);
            }),
            'contains' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('user_type', 'like', '%'.$like.'%')
                    ->orWhereRaw("{$displayExpr} LIKE ?", ['%'.$like.'%']);
            }),
            'notContains' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('user_type', 'not like', '%'.$like.'%')
                    ->whereRaw("{$displayExpr} NOT LIKE ?", ['%'.$like.'%']);
            }),
            'startsWith' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('user_type', 'like', $like.'%')
                    ->orWhereRaw("{$displayExpr} LIKE ?", [$like.'%']);
            }),
            'endsWith' => $query->where(function (Builder $inner) use ($like, $displayExpr): void {
                $inner->where('user_type', 'like', '%'.$like)
                    ->orWhereRaw("{$displayExpr} LIKE ?", ['%'.$like]);
            }),
            default => null,
        };
    }

    /**
     * @param  Builder<RateCard>  $query
     */
    private function applyIsActiveFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank' || $type === 'notBlank') {
            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $active = $this->parseActiveFilterValue($value);

        match ($type) {
            'equals' => $active === null ? null : $query->where('is_active', $active),
            'notEqual' => $active === null ? null : $query->where('is_active', '!=', $active),
            default => null,
        };
    }

    /**
     * @param  Builder<RateCard>  $query
     */
    private function applyLinkedCompaniesFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank') {
            $query->whereDoesntHave('restrictedCompanies');

            return;
        }

        if ($type === 'notBlank') {
            $query->whereHas('restrictedCompanies');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->whereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', $value),
            ),
            'notEqual' => $query->whereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', '!=', $value),
            ),
            'contains' => $query->whereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', 'like', '%'.$like.'%'),
            ),
            'notContains' => $query->whereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', 'not like', '%'.$like.'%'),
            ),
            'startsWith' => $query->whereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', 'like', $like.'%'),
            ),
            'endsWith' => $query->whereHas(
                'restrictedCompanies',
                static fn (Builder $companyQuery) => $companyQuery->where('business_name', 'like', '%'.$like),
            ),
            default => null,
        };
    }

    private function parseActiveFilterValue(string $value): ?bool
    {
        $normalized = strtolower(trim($value));

        return match ($normalized) {
            '1', 'true', 'yes', 'active' => true,
            '0', 'false', 'no', 'inactive' => false,
            default => null,
        };
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}

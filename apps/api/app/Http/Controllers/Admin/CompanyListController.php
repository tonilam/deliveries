<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListCompaniesRequest;
use App\Models\Company;
use App\Models\CompanyAllowedDomain;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class CompanyListController extends Controller
{
    public function __invoke(ListCompaniesRequest $request): JsonResponse
    {
        $query = Company::query();
        $this->applyFilters($query, $request->filters());
        $this->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->with(['country' => static fn ($q) => $q->select('id', 'name', 'code')])
            ->withCount('addresses')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'companies' => collect($paginator->items())
                ->map(static fn (Company $company) => $company->toAdminPayload())
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
     * @param  Builder<Company>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'allowed_domains') {
            $domainSubquery = CompanyAllowedDomain::query()
                ->select('domain')
                ->whereColumn('company_id', 'companies.id')
                ->orderBy('domain')
                ->limit(1);

            $query->orderBy($domainSubquery, $direction)->orderBy('id');

            return;
        }

        $query->orderBy($sort, $direction)->orderBy('id');
    }

    /**
     * @param  Builder<Company>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $type = $filter['type'];
            $value = $filter['filter'];

            if ($column === 'allowed_domains') {
                $this->applyAllowedDomainsFilter($query, $type, $value);

                continue;
            }

            $this->applyColumnFilter($query, $column, $type, $value);
        }
    }

    /**
     * @param  Builder<Company>  $query
     */
    private function applyColumnFilter(Builder $query, string $column, string $type, ?string $value): void
    {
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
     * @param  Builder<Company>  $query
     */
    private function applyAllowedDomainsFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank') {
            $query->whereDoesntHave('allowedDomainRows');

            return;
        }

        if ($type === 'notBlank') {
            $query->whereHas('allowedDomainRows');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $normalized = strtolower(rtrim(ltrim(trim($value), '@'), '.'));
        if ($normalized === '') {
            return;
        }

        $like = $this->escapeLike($normalized);

        match ($type) {
            'equals' => $query->whereHas(
                'allowedDomainRows',
                fn (Builder $inner) => $inner->where('domain', $normalized),
            ),
            'notEqual' => $query->whereDoesntHave(
                'allowedDomainRows',
                fn (Builder $inner) => $inner->where('domain', $normalized),
            ),
            'contains' => $query->whereHas(
                'allowedDomainRows',
                fn (Builder $inner) => $inner->where('domain', 'like', '%'.$like.'%'),
            ),
            'notContains' => $query->whereDoesntHave(
                'allowedDomainRows',
                fn (Builder $inner) => $inner->where('domain', 'like', '%'.$like.'%'),
            ),
            'startsWith' => $query->whereHas(
                'allowedDomainRows',
                fn (Builder $inner) => $inner->where('domain', 'like', $like.'%'),
            ),
            'endsWith' => $query->whereHas(
                'allowedDomainRows',
                fn (Builder $inner) => $inner->where('domain', 'like', '%'.$like),
            ),
            default => null,
        };
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}

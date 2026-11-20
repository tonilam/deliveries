<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListUsersRequest;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class UserListController extends Controller
{
    public function __invoke(ListUsersRequest $request): JsonResponse
    {
        $role = $request->role();

        $query = User::query()->where('role', $role);
        $this->applyFilters($query, $request->filters());
        $this->applySort($query, $request->sort(), $request->direction());

        if ($role === UserRole::Customer) {
            $query->with('company:id,business_name');
        }

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->paginate($perPage, ['id', 'name', 'email', 'is_active', 'password', 'company_id'], 'page', $page)
            ->withQueryString();

        $users = collect($paginator->items())->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'has_password' => $user->has_password,
            'company' => $user->company?->business_name,
        ]);

        return response()->json([
            'users' => $users,
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
     * @param  Builder<User>  $query
     */
    private function applySort(Builder $query, string $sort, string $direction): void
    {
        if ($sort === 'company') {
            $companyName = Company::query()
                ->select('business_name')
                ->whereColumn('companies.id', 'users.company_id')
                ->limit(1);

            $query->orderBy($companyName, $direction)->orderBy('id');

            return;
        }

        if ($sort === 'is_active') {
            $query->orderBy('is_active', $direction)->orderBy('id');

            return;
        }

        $query->orderBy($sort, $direction)->orderBy('id');
    }

    /**
     * @param  Builder<User>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $type = $filter['type'];
            $value = $filter['filter'];

            if ($column === 'company') {
                $this->applyCompanyFilter($query, $type, $value);

                continue;
            }

            if ($column === 'is_active') {
                $this->applyActiveFilter($query, $type, $value);

                continue;
            }

            $this->applyColumnFilter($query, $column, $type, $value);
        }
    }

    /**
     * @param  Builder<User>  $query
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
     * @param  Builder<User>  $query
     */
    private function applyCompanyFilter(Builder $query, string $type, ?string $value): void
    {
        if ($type === 'blank') {
            $query->where(function (Builder $inner): void {
                $inner->whereNull('company_id')
                    ->orWhereDoesntHave('company');
            });

            return;
        }

        if ($type === 'notBlank') {
            $query->whereHas('company');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $query->whereHas(
                'company',
                fn (Builder $inner) => $inner->where('business_name', $value),
            ),
            'notEqual' => $query->where(function (Builder $outer) use ($value): void {
                $outer->whereDoesntHave(
                    'company',
                    fn (Builder $inner) => $inner->where('business_name', $value),
                );
            }),
            'contains' => $query->whereHas(
                'company',
                fn (Builder $inner) => $inner->where('business_name', 'like', '%'.$like.'%'),
            ),
            'notContains' => $query->where(function (Builder $outer) use ($like): void {
                $outer->whereDoesntHave(
                    'company',
                    fn (Builder $inner) => $inner->where('business_name', 'like', '%'.$like.'%'),
                );
            }),
            'startsWith' => $query->whereHas(
                'company',
                fn (Builder $inner) => $inner->where('business_name', 'like', $like.'%'),
            ),
            'endsWith' => $query->whereHas(
                'company',
                fn (Builder $inner) => $inner->where('business_name', 'like', '%'.$like),
            ),
            default => null,
        };
    }

    /**
     * @param  Builder<User>  $query
     */
    private function applyActiveFilter(Builder $query, string $type, ?string $value): void
    {
        $displayExpr = "CASE WHEN is_active THEN 'Yes' ELSE 'No' END";

        if ($type === 'blank') {
            $query->whereNull('is_active');

            return;
        }

        if ($type === 'notBlank') {
            $query->whereNotNull('is_active');

            return;
        }

        if ($value === null || $value === '') {
            return;
        }

        $bool = $this->parseActiveValue($value);
        $like = $this->escapeLike($value);

        match ($type) {
            'equals' => $bool === null
                ? $query->whereRaw("{$displayExpr} = ?", [$value])
                : $query->where('is_active', $bool),
            'notEqual' => $bool === null
                ? $query->whereRaw("{$displayExpr} != ?", [$value])
                : $query->where('is_active', '!=', $bool),
            'contains' => $query->whereRaw("{$displayExpr} LIKE ?", ['%'.$like.'%']),
            'notContains' => $query->whereRaw("{$displayExpr} NOT LIKE ?", ['%'.$like.'%']),
            'startsWith' => $query->whereRaw("{$displayExpr} LIKE ?", [$like.'%']),
            'endsWith' => $query->whereRaw("{$displayExpr} LIKE ?", ['%'.$like]),
            default => null,
        };
    }

    private function parseActiveValue(string $value): ?bool
    {
        return match (strtolower(trim($value))) {
            'yes', 'true', '1', 'y' => true,
            'no', 'false', '0', 'n' => false,
            default => null,
        };
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}

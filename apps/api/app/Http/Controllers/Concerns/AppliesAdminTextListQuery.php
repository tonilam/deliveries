<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

trait AppliesAdminTextListQuery
{
    /**
     * @param  Builder<Model>  $query
     * @param  list<string>  $columns
     */
    protected function applyAdminSearch(Builder $query, ?string $search, array $columns): void
    {
        if ($search === null) {
            return;
        }

        $like = '%'.$this->escapeLikeForList($search).'%';

        $query->where(function (Builder $inner) use ($columns, $like): void {
            foreach ($columns as $index => $column) {
                if ($index === 0) {
                    $inner->where($column, 'like', $like);
                } else {
                    $inner->orWhere($column, 'like', $like);
                }
            }
        });
    }

    /**
     * @param  Builder<Model>  $query
     * @param  array<string, array{type: string, filter: ?string}>  $filters
     */
    protected function applyAdminFilters(Builder $query, array $filters): void
    {
        foreach ($filters as $column => $filter) {
            $this->applyAdminColumnFilter($query, $column, $filter['type'], $filter['filter']);
        }
    }

    /**
     * @param  Builder<Model>  $query
     */
    protected function applyAdminColumnFilter(Builder $query, string $column, string $type, ?string $value): void
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

        $like = $this->escapeLikeForList($value);

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

    protected function escapeLikeForList(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}

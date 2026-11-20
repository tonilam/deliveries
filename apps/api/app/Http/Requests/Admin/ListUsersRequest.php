<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListUsersRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 25;

    /** @var list<int> */
    public const ALLOWED_PER_PAGE = [10, 25, 50, 100, 200];

    /** @var list<string> */
    public const BASE_FILTERABLE_COLUMNS = [
        'name',
        'email',
        'is_active',
    ];

    /** @var list<string> */
    public const CUSTOMER_EXTRA_COLUMNS = [
        'company',
    ];

    public const DEFAULT_SORT = 'name';

    public const DEFAULT_DIRECTION = 'asc';

    /** @var list<string> */
    public const SORT_DIRECTIONS = ['asc', 'desc'];

    /** @var list<string> */
    public const FILTER_TYPES = [
        'equals',
        'notEqual',
        'contains',
        'notContains',
        'startsWith',
        'endsWith',
        'blank',
        'notBlank',
    ];

    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $columns = $this->filterableColumns();

        $rules = [
            'role' => ['required', 'string', Rule::enum(UserRole::class)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', Rule::in(self::ALLOWED_PER_PAGE)],
            'sort' => ['sometimes', 'string', Rule::in($columns)],
            'direction' => ['sometimes', 'string', Rule::in(self::SORT_DIRECTIONS)],
            'filter' => ['sometimes', 'array'],
        ];

        foreach ($columns as $column) {
            $rules["filter.{$column}"] = ['sometimes', 'array'];
            $rules["filter.{$column}.type"] = [
                'required_with:filter.'.$column,
                'string',
                Rule::in(self::FILTER_TYPES),
            ];
            $rules["filter.{$column}.filter"] = ['nullable', 'string', 'max:255'];
        }

        return $rules;
    }

    public function role(): UserRole
    {
        return UserRole::from((string) $this->validated('role'));
    }

    public function perPage(): int
    {
        return (int) $this->validated('per_page', self::DEFAULT_PER_PAGE);
    }

    public function sort(): string
    {
        $sort = $this->validated('sort', self::DEFAULT_SORT);
        $columns = $this->filterableColumns();

        if (! is_string($sort) || ! in_array($sort, $columns, true)) {
            return self::DEFAULT_SORT;
        }

        return $sort;
    }

    public function direction(): string
    {
        $direction = $this->validated('direction', self::DEFAULT_DIRECTION);

        return is_string($direction) ? $direction : self::DEFAULT_DIRECTION;
    }

    /**
     * @return array<string, array{type: string, filter: ?string}>
     */
    public function filters(): array
    {
        $raw = $this->validated('filter', []);
        if (! is_array($raw)) {
            return [];
        }

        $filters = [];
        foreach ($this->filterableColumns() as $column) {
            if (! isset($raw[$column]) || ! is_array($raw[$column])) {
                continue;
            }

            $type = $raw[$column]['type'] ?? null;
            if (! is_string($type) || ! in_array($type, self::FILTER_TYPES, true)) {
                continue;
            }

            $value = $raw[$column]['filter'] ?? null;
            $filters[$column] = [
                'type' => $type,
                'filter' => is_string($value) ? $value : null,
            ];
        }

        return $filters;
    }

    /**
     * @return list<string>
     */
    public function filterableColumns(): array
    {
        $role = $this->input('role');
        if ($role === UserRole::Customer->value || $role === UserRole::Customer) {
            return [...self::BASE_FILTERABLE_COLUMNS, ...self::CUSTOMER_EXTRA_COLUMNS];
        }

        return self::BASE_FILTERABLE_COLUMNS;
    }
}

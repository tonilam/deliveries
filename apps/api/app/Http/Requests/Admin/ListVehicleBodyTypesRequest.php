<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListVehicleBodyTypesRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 25;

    /** @var list<int> */
    public const ALLOWED_PER_PAGE = [10, 25, 50, 100, 200];

    /** @var list<string> */
    public const FILTERABLE_COLUMNS = ['name', 'code', 'capacity_unit'];

    /** @var list<string> */
    public const SORTABLE_COLUMNS = [
        'name',
        'code',
        'capacity',
        'capacity_unit',
        'pallet_spaces',
        'payload_kg',
    ];

    public const DEFAULT_SORT = 'name';

    public const DEFAULT_DIRECTION = 'asc';

    /** @var list<string> */
    public const SORT_DIRECTIONS = ['asc', 'desc'];

    /** @var list<string> */
    public const FILTER_TYPES = ListVehicleCategoriesRequest::FILTER_TYPES;

    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', Rule::in(self::ALLOWED_PER_PAGE)],
            'sort' => ['sometimes', 'string', Rule::in(self::SORTABLE_COLUMNS)],
            'direction' => ['sometimes', 'string', Rule::in(self::SORT_DIRECTIONS)],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'filter' => ['sometimes', 'array'],
        ];

        foreach (self::FILTERABLE_COLUMNS as $column) {
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

    public function perPage(): int
    {
        return (int) $this->validated('per_page', self::DEFAULT_PER_PAGE);
    }

    public function sort(): string
    {
        $sort = $this->validated('sort', self::DEFAULT_SORT);

        return is_string($sort) ? $sort : self::DEFAULT_SORT;
    }

    public function direction(): string
    {
        $direction = $this->validated('direction', self::DEFAULT_DIRECTION);

        return is_string($direction) ? $direction : self::DEFAULT_DIRECTION;
    }

    public function search(): ?string
    {
        $search = $this->validated('search');
        if (! is_string($search)) {
            return null;
        }
        $trimmed = trim($search);

        return $trimmed === '' ? null : $trimmed;
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
        foreach (self::FILTERABLE_COLUMNS as $column) {
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
}

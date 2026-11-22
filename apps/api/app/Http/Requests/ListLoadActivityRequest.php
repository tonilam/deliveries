<?php

namespace App\Http\Requests;

use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListLoadActivityRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 25;

    /** @var list<int> */
    public const ALLOWED_PER_PAGE = [10, 25, 50, 100, 200];

    public function authorize(): bool
    {
        $load = $this->route('load');

        return $load instanceof Load && ($this->user()?->can('view', $load) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', Rule::in(self::ALLOWED_PER_PAGE)],
        ];
    }

    public function perPage(): int
    {
        $perPage = $this->integer('per_page');

        return in_array($perPage, self::ALLOWED_PER_PAGE, true)
            ? $perPage
            : self::DEFAULT_PER_PAGE;
    }
}

<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class ListZoneOptionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'country_id' => ['sometimes', 'nullable', 'integer', 'exists:countries,id'],
        ];
    }

    public function countryId(): ?int
    {
        $value = $this->validated('country_id');

        return $value === null ? null : (int) $value;
    }
}

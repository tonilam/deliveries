<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Models\Zone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateZoneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code') && is_string($this->input('code'))) {
            $this->merge([
                'code' => strtoupper(trim($this->input('code'))),
            ]);
        }

        if ($this->has('name') && is_string($this->input('name'))) {
            $this->merge([
                'name' => trim($this->input('name')),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Zone $zone */
        $zone = $this->route('zone');
        $countryId = $this->input('country_id', $zone->country_id);

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:10',
                'regex:/^[A-Z0-9]+$/',
                Rule::unique('zones', 'code')
                    ->where(fn ($query) => $query->where('country_id', $countryId)->whereNull('deleted_at'))
                    ->ignore($zone->id),
            ],
            'country_id' => ['required', 'integer', 'exists:countries,id'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}

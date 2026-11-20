<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCountryStateRequest extends FormRequest
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
        /** @var Country $country */
        $country = $this->route('country');
        /** @var CountryState $state */
        $state = $this->route('state');

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:10',
                'alpha',
                Rule::unique('country_states', 'code')
                    ->where('country_id', $country->id)
                    ->ignore($state->id),
            ],
        ];
    }
}

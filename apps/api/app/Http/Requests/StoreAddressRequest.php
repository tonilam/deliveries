<?php

namespace App\Http\Requests;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\Company;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Address::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $countryId = $this->companyCountryId();

        return [
            'type' => ['required', 'string', Rule::enum(AddressType::class)],
            'business_name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'zone_id' => [
                'required',
                'integer',
                Rule::when(
                    $countryId !== null,
                    Rule::exists('zones', 'id')->where(fn ($query) => $query
                        ->where('country_id', $countryId)
                        ->where('is_active', true)),
                ),
            ],
            'state' => [
                'required',
                'string',
                'max:255',
                Rule::when(
                    $countryId !== null,
                    Rule::exists('country_states', 'code')->where('country_id', $countryId),
                ),
            ],
            'postcode' => ['required', 'string', 'max:32'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->companyCountryId() === null) {
                $validator->errors()->add(
                    'state',
                    'Your company must have a country before addresses can be saved.',
                );
                $validator->errors()->add(
                    'zone_id',
                    'Your company must have a country before addresses can be saved.',
                );
            }
        });
    }

    private function companyCountryId(): ?int
    {
        $companyId = $this->user()?->company_id;
        if ($companyId === null) {
            return null;
        }

        $countryId = Company::query()->whereKey($companyId)->value('country_id');

        return is_numeric($countryId) ? (int) $countryId : null;
    }
}

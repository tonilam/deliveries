<?php

namespace App\Http\Requests;

use App\Enums\CompanyType;
use App\Http\Requests\Concerns\AuthorizesNetworkCompany;
use App\Models\Company;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreNetworkCompanyRequest extends FormRequest
{
    use AuthorizesNetworkCompany;

    public function authorize(): bool
    {
        return $this->user()?->can('createNetwork', Company::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'network_type' => ['required', 'string', Rule::in([CompanyType::Customer->value, CompanyType::Provider->value])],
            'country_id' => ['required', 'integer', 'exists:countries,id'],
            'reg_number' => ['required', 'string', 'max:255'],
            'reg_type' => ['required', 'string', 'max:255'],
            'business_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'address' => ['required', 'string', 'max:1000'],
            'allowed_domains' => ['required', 'array', 'min:1'],
            'allowed_domains.*' => ['required', 'string', 'max:255'],
        ];
    }

    public function networkType(): CompanyType
    {
        $raw = $this->validated('network_type');

        return CompanyType::from(is_string($raw) ? $raw : CompanyType::Customer->value);
    }
}

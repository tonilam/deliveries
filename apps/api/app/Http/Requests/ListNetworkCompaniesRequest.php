<?php

namespace App\Http\Requests;

use App\Enums\CompanyType;
use App\Http\Requests\Concerns\AuthorizesNetworkCompany;
use App\Http\Requests\Concerns\ValidatesNetworkCompanyListParams;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListNetworkCompaniesRequest extends FormRequest
{
    use AuthorizesNetworkCompany;
    use ValidatesNetworkCompanyListParams;

    public function authorize(): bool
    {
        return $this->customerCanManageNetwork();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_merge($this->networkListParamRules(), [
            'network_type' => ['required', 'string', Rule::in([CompanyType::Customer->value, CompanyType::Provider->value])],
        ]);
    }

    public function networkType(): CompanyType
    {
        $raw = $this->validated('network_type');

        return CompanyType::from(is_string($raw) ? $raw : CompanyType::Customer->value);
    }
}

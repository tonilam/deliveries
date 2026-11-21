<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesNetworkCompany;
use Illuminate\Foundation\Http\FormRequest;

class CheckNetworkCompanyUniquenessRequest extends FormRequest
{
    use AuthorizesNetworkCompany;

    public function authorize(): bool
    {
        return $this->customerCanManageNetwork();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'company_id' => ['sometimes', 'nullable', 'integer', 'exists:companies,id'],
            'reg_number' => ['required', 'string', 'max:255'],
            'business_name' => ['required', 'string', 'max:255'],
            'allowed_domains' => ['required', 'array', 'min:1'],
            'allowed_domains.*' => ['required', 'string', 'max:255'],
        ];
    }
}

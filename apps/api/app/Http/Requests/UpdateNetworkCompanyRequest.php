<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesNetworkCompany;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNetworkCompanyRequest extends FormRequest
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
}

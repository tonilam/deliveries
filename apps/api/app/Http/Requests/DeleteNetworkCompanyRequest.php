<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesNetworkCompany;
use Illuminate\Foundation\Http\FormRequest;

class DeleteNetworkCompanyRequest extends FormRequest
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
        return [];
    }
}

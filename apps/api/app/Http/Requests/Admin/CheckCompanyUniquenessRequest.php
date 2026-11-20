<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class CheckCompanyUniquenessRequest extends FormRequest
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
            'reg_number' => ['required', 'string', 'max:255'],
            'business_name' => ['required', 'string', 'max:255'],
            'allowed_domains' => ['required', 'array', 'min:1'],
            'allowed_domains.*' => ['required', 'string', 'max:255'],
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
        ];
    }
}

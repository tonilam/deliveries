<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    public function isFinanceOnly(): bool
    {
        return $this->input('section') === 'finance';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        if ($this->isFinanceOnly()) {
            return [
                'section' => ['required', Rule::in(['finance'])],
                'invoicee_name' => ['nullable', 'string', 'max:255'],
                'gst_rate' => ['required', 'numeric', 'min:0', 'max:1'],
                'tracking_option' => ['nullable', 'string', 'max:255'],
            ];
        }

        return [
            'section' => ['sometimes', Rule::in(['details'])],
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

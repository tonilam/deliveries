<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class CreateUserRequest extends FormRequest
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
        $role = $this->string('role')->toString();

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => ['required', 'string', Rule::enum(UserRole::class)],
            'must_change_password' => ['sometimes', 'boolean'],
            'company_id' => [
                Rule::requiredIf($role === UserRole::Customer->value),
                'nullable',
                'integer',
                'exists:companies,id',
                Rule::prohibitedIf($role === UserRole::Admin->value),
            ],
        ];
    }
}

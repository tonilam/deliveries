<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class ResetUserPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'password' => ['required', 'confirmed', Password::defaults()],
            'must_change_password' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var User $user */
            $user = $this->route('user');

            if (! $user->has_password) {
                $validator->errors()->add('user', 'Password reset is not available for SSO-only users.');

                return;
            }

            if ($user->role !== UserRole::Customer) {
                $validator->errors()->add('user', 'Admins can only set a new password for customer users. Send a reset email instead.');
            }
        });
    }
}

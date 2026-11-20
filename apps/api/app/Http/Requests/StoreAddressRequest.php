<?php

namespace App\Http\Requests;

use App\Enums\AddressType;
use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->role === UserRole::Customer && $user->company_id !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::enum(AddressType::class)],
            'business_name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'zone' => ['required', 'string', 'max:255'],
            'state' => ['required', 'string', 'max:255'],
            'postcode' => ['required', 'string', 'max:32'],
        ];
    }
}

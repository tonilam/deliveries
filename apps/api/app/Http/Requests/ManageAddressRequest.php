<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesCompanyAddress;
use Illuminate\Foundation\Http\FormRequest;

class ManageAddressRequest extends FormRequest
{
    use AuthorizesCompanyAddress;

    public function authorize(): bool
    {
        return $this->customerCanAccessCompanyAddress($this->routeAddress());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

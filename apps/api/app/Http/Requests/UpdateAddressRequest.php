<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesCompanyAddress;

class UpdateAddressRequest extends StoreAddressRequest
{
    use AuthorizesCompanyAddress;

    public function authorize(): bool
    {
        return $this->customerCanAccessCompanyAddress($this->routeAddress());
    }
}

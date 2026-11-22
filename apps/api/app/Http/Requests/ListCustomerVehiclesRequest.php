<?php

namespace App\Http\Requests;

use App\Models\Company;
use Illuminate\Foundation\Http\FormRequest;

class ListCustomerVehiclesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageVehicles', Company::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesCompanyRateCard;
use Illuminate\Foundation\Http\FormRequest;

class ManageRateCardRequest extends FormRequest
{
    use AuthorizesCompanyRateCard;

    public function authorize(): bool
    {
        return $this->customerCanAccessCompanyRateCard($this->routeRateCard());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

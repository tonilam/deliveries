<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesCompanyRateCard;
use Illuminate\Foundation\Http\FormRequest;

class RateCardCompanyOptionsRequest extends FormRequest
{
    use AuthorizesCompanyRateCard;

    public function authorize(): bool
    {
        return $this->customerCanManageCompanyRateCards();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function queryString(): ?string
    {
        $q = $this->validated('q');
        if (! is_string($q)) {
            return null;
        }
        $trimmed = trim($q);

        return $trimmed === '' ? null : $trimmed;
    }
}

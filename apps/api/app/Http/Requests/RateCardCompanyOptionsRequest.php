<?php

namespace App\Http\Requests;

use App\Enums\RateCardUserType;
use App\Http\Requests\Concerns\AuthorizesCompanyRateCard;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'user_type' => ['required', 'string', Rule::enum(RateCardUserType::class)],
        ];
    }

    public function restrictionType(): RateCardUserType
    {
        $raw = $this->validated('user_type');

        return $raw instanceof RateCardUserType
            ? $raw
            : RateCardUserType::from(is_string($raw) ? $raw : RateCardUserType::Customer->value);
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

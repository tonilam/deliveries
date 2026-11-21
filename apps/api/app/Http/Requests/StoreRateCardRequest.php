<?php

namespace App\Http\Requests;

use App\Enums\RateCardUserType;
use App\Http\Requests\Concerns\AuthorizesCompanyRateCard;
use App\Http\Requests\Concerns\ValidatesRateCardPayload;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreRateCardRequest extends FormRequest
{
    use AuthorizesCompanyRateCard;
    use ValidatesRateCardPayload;

    public function authorize(): bool
    {
        return $this->customerCanManageCompanyRateCards();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return $this->rateCardFieldRules();
    }

    public function withValidator(Validator $validator): void
    {
        $this->withRateCardValidator($validator);
    }

    public function userType(): RateCardUserType
    {
        return RateCardUserType::from($this->string('user_type')->toString());
    }
}

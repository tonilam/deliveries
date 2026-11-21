<?php

namespace App\Http\Requests;

use App\Enums\RateCardUserType;
use App\Http\Requests\Concerns\ValidatesRateCardPayload;
use App\Models\RateCard;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateRateCardRequest extends FormRequest
{
    use ValidatesRateCardPayload;

    public function authorize(): bool
    {
        $rateCard = $this->route('rateCard');

        return $rateCard instanceof RateCard
            && ($this->user()?->can('update', $rateCard) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rateCard = $this->route('rateCard');

        return $this->rateCardFieldRules($rateCard instanceof RateCard ? $rateCard->id : null);
    }

    public function withValidator(Validator $validator): void
    {
        $rateCard = $this->route('rateCard');
        $this->withRateCardValidator(
            $validator,
            $rateCard instanceof RateCard ? $rateCard->id : null,
        );
    }

    public function userType(): RateCardUserType
    {
        return RateCardUserType::from($this->string('user_type')->toString());
    }
}

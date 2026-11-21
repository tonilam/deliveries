<?php

namespace App\Http\Requests;

use App\Models\RateCard;
use Illuminate\Foundation\Http\FormRequest;

class ManageRateCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        $rateCard = $this->route('rateCard');

        return $rateCard instanceof RateCard
            && ($this->user()?->can('view', $rateCard) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

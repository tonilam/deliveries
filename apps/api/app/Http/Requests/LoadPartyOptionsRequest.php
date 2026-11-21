<?php

namespace App\Http\Requests;

use App\Enums\CompanyType;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LoadPartyOptionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Load::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'party_type' => ['required', 'string', Rule::in(['customer', 'provider'])],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function partyType(): CompanyType
    {
        return $this->string('party_type')->toString() === 'provider'
            ? CompanyType::Provider
            : CompanyType::Customer;
    }

    public function queryText(): ?string
    {
        $q = $this->validated('q');
        if (! is_string($q)) {
            return null;
        }
        $trimmed = trim($q);

        return $trimmed === '' ? null : $trimmed;
    }
}

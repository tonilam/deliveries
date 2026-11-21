<?php

namespace App\Http\Requests;

use App\Enums\AddressType;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LoadAddressOptionsRequest extends FormRequest
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
            'address_type' => ['required', 'string', Rule::in(['collection', 'delivery'])],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function addressType(): AddressType
    {
        return $this->string('address_type')->toString() === 'collection'
            ? AddressType::Collection
            : AddressType::Delivery;
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

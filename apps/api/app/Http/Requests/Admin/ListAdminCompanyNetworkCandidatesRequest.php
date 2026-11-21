<?php

namespace App\Http\Requests\Admin;

use App\Enums\CompanyType;
use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListAdminCompanyNetworkCandidatesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in([CompanyType::Customer->value, CompanyType::Provider->value])],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function networkType(): CompanyType
    {
        $raw = $this->validated('type');

        return CompanyType::from(is_string($raw) ? $raw : CompanyType::Customer->value);
    }

    public function search(): ?string
    {
        $search = $this->validated('search');
        if (! is_string($search)) {
            return null;
        }
        $trimmed = trim($search);

        return $trimmed === '' ? null : $trimmed;
    }
}

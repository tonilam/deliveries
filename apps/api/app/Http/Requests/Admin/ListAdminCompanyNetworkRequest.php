<?php

namespace App\Http\Requests\Admin;

use App\Enums\CompanyType;
use App\Enums\UserRole;
use App\Http\Requests\Concerns\ValidatesNetworkCompanyListParams;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListAdminCompanyNetworkRequest extends FormRequest
{
    use ValidatesNetworkCompanyListParams;

    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_merge($this->networkListParamRules(), [
            'type' => ['required', 'string', Rule::in([CompanyType::Customer->value, CompanyType::Provider->value])],
        ]);
    }

    public function networkType(): CompanyType
    {
        $raw = $this->validated('type');

        return CompanyType::from(is_string($raw) ? $raw : CompanyType::Customer->value);
    }
}

<?php

namespace App\Http\Requests\Admin;

use App\Enums\CompanyType;
use App\Enums\UserRole;
use App\Models\Company;
use App\Services\CompanyTypeService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

class LinkAdminCompanyNetworkRequest extends FormRequest
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
            'company_id' => ['required', 'integer', 'exists:companies,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $parent = $this->route('company');
            if (! $parent instanceof Company) {
                return;
            }

            $child = Company::query()->find($this->integer('company_id'));
            if ($child === null) {
                $validator->errors()->add('company_id', 'Company not found.');

                return;
            }

            /** @var CompanyTypeService $companyTypes */
            $companyTypes = app(CompanyTypeService::class);

            if ($parent->parent_company_id !== null) {
                $validator->errors()->add('company', 'Only root companies can have a network.');
            }

            if ($child->id === $parent->id) {
                $validator->errors()->add('company_id', 'A company cannot be linked to itself.');
            }

            if ($child->parent_company_id !== null) {
                $validator->errors()->add('company_id', 'This company already belongs to a network.');
            }

            if ($child->children()->exists()) {
                $validator->errors()->add('company_id', 'Companies with linked children cannot be moved into a network.');
            }

            $childType = $companyTypes->resolveType($child);
            if ($childType === CompanyType::Broker) {
                $validator->errors()->add('company_id', 'Broker companies cannot be linked as network children.');
            }

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            try {
                $companyTypes->assertChildTypeAllowedForParent($parent, $childType);
            } catch (ValidationException $exception) {
                foreach ($exception->errors() as $field => $messages) {
                    foreach ($messages as $message) {
                        $validator->errors()->add($field, $message);
                    }
                }
            }
        });
    }

    public function childCompanyId(): int
    {
        return (int) $this->validated('company_id');
    }
}

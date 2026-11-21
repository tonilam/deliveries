<?php

namespace App\Services;

use App\Enums\CompanyType;
use App\Models\Company;
use Illuminate\Validation\ValidationException;

class CompanyTypeService
{
    public function assertAdminNetworkListAllowed(Company $parent, CompanyType $networkType): void
    {
        if ($parent->parent_company_id !== null) {
            throw ValidationException::withMessages([
                'company' => ['Only root companies can have a network.'],
            ]);
        }

        $parentType = $this->resolveType($parent);

        if (! $parentType->allowsNetworkTab($networkType)) {
            throw ValidationException::withMessages([
                'type' => ['This network list is not available for this company type.'],
            ]);
        }
    }

    public function assertChildTypeAllowedForParent(Company $parent, CompanyType $childType): void
    {
        if ($parent->parent_company_id !== null) {
            throw ValidationException::withMessages([
                'company_type' => ['Parent company must be a root company.'],
            ]);
        }

        $parentType = $this->resolveType($parent);

        if (! $parentType->allowsNetworkTab($childType)) {
            throw ValidationException::withMessages([
                'company_type' => [
                    'This company type is not allowed for '.$parentType->label().' companies.',
                ],
            ]);
        }
    }

    public function assertAdminRootTypeChange(Company $company, CompanyType $newType): void
    {
        if ($company->parent_company_id !== null) {
            return;
        }

        $currentType = $this->resolveType($company);
        if ($currentType === $newType) {
            return;
        }

        $allowedChildTypes = $newType->allowedChildTypes();
        $disallowed = $company->children()
            ->whereNotIn('company_type', array_map(static fn (CompanyType $t) => $t->value, $allowedChildTypes))
            ->exists();

        if ($disallowed) {
            throw ValidationException::withMessages([
                'company_type' => [
                    'Cannot change type while linked companies exist that are not allowed for '.$newType->label().'.',
                ],
            ]);
        }
    }

    public function assertAdminCompanyType(Company $company, CompanyType $type): void
    {
        if ($company->parent_company_id !== null) {
            if ($type === CompanyType::Broker) {
                throw ValidationException::withMessages([
                    'company_type' => ['Linked companies cannot be Broker.'],
                ]);
            }

            $parent = $company->parent ?? Company::query()->find($company->parent_company_id);
            if ($parent !== null) {
                $this->assertChildTypeAllowedForParent($parent, $type);
            }

            return;
        }

        if (! in_array($type, CompanyType::rootOptions(), true)) {
            throw ValidationException::withMessages([
                'company_type' => ['Invalid company type.'],
            ]);
        }
    }

    public function resolveType(Company $company): CompanyType
    {
        $raw = $company->company_type;

        return $raw instanceof CompanyType
            ? $raw
            : CompanyType::from(is_string($raw) ? $raw : CompanyType::Broker->value);
    }

    public function companyCanDelete(Company $company): ?string
    {
        if ($company->users()->exists()) {
            return 'This company has users and cannot be deleted.';
        }

        if ($company->addresses()->exists()) {
            return 'This company has addresses and cannot be deleted.';
        }

        if ($company->rateCards()->exists()) {
            return 'This company has rate cards and cannot be deleted.';
        }

        if ($company->children()->exists()) {
            return 'This company has linked companies and cannot be deleted.';
        }

        if ($company->rateCardLinks()->exists()) {
            return 'This company is linked on rate cards and cannot be deleted.';
        }

        return null;
    }
}

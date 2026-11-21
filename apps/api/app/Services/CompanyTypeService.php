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

    /**
     * @return list<string>
     */
    public function blockedAdminRootCompanyTypes(Company $company): array
    {
        if ($company->parent_company_id !== null) {
            $currentType = $this->resolveType($company);

            return match ($currentType) {
                CompanyType::Customer => [CompanyType::Provider->value],
                CompanyType::Provider => [CompanyType::Customer->value],
                default => [],
            };
        }

        $currentType = $this->resolveType($company);
        $blocked = [];

        foreach (CompanyType::rootOptions() as $candidate) {
            if ($candidate === $currentType) {
                continue;
            }

            if ($this->wouldBlockRootTypeChange($company, $candidate)) {
                $blocked[] = $candidate->value;
            }
        }

        return $blocked;
    }

    public function assertAdminLinkedTypeChange(Company $company, CompanyType $newType): void
    {
        if ($company->parent_company_id === null) {
            return;
        }

        $currentType = $this->resolveType($company);
        if ($currentType === $newType) {
            return;
        }

        if (
            in_array($currentType, CompanyType::linkedOptions(), true)
            && in_array($newType, CompanyType::linkedOptions(), true)
        ) {
            throw ValidationException::withMessages([
                'company_type' => [$this->linkedTypeChangeBlockedMessage($company)],
            ]);
        }
    }

    private function linkedTypeChangeBlockedMessage(Company $company): string
    {
        $parent = $company->parent ?? Company::query()->find($company->parent_company_id);
        $parentName = $parent?->business_name ?? 'the parent company';
        $role = $this->resolveType($company)->label();

        return 'Cannot change company type while linked as a '.$role.' of '.$parentName.'.';
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

        if (! $this->wouldBlockRootTypeChange($company, $newType)) {
            return;
        }

        throw ValidationException::withMessages([
            'company_type' => [$this->rootTypeChangeBlockedMessage($company, $newType)],
        ]);
    }

    public function wouldBlockRootTypeChange(Company $company, CompanyType $newType): bool
    {
        if ($company->parent_company_id !== null) {
            return false;
        }

        if ($this->resolveType($company) === $newType) {
            return false;
        }

        $allowedValues = array_map(
            static fn (CompanyType $t) => $t->value,
            $newType->allowedChildTypes(),
        );

        return $company->children()->whereNotIn('company_type', $allowedValues)->exists();
    }

    private function rootTypeChangeBlockedMessage(Company $company, CompanyType $newType): string
    {
        $allowedValues = array_map(
            static fn (CompanyType $t) => $t->value,
            $newType->allowedChildTypes(),
        );

        $conflictingTypes = $company->children()
            ->whereNotIn('company_type', $allowedValues)
            ->pluck('company_type')
            ->unique()
            ->map(function (mixed $raw): CompanyType {
                return $raw instanceof CompanyType
                    ? $raw
                    : CompanyType::from(is_string($raw) ? $raw : CompanyType::Broker->value);
            });

        if ($newType === CompanyType::Customer && $conflictingTypes->contains(CompanyType::Customer)) {
            return 'Cannot change to Customer while linked customer companies exist.';
        }

        if ($newType === CompanyType::Provider && $conflictingTypes->contains(CompanyType::Provider)) {
            return 'Cannot change to Provider while linked provider companies exist.';
        }

        return 'Cannot change type while linked companies exist that are not allowed for '.$newType->label().'.';
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

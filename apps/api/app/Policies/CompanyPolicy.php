<?php

namespace App\Policies;

use App\Enums\CompanyType;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\User;

class CompanyPolicy
{
    public function viewAnyNetwork(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function createNetwork(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function viewNetwork(User $user, Company $company): bool
    {
        return $this->managesNetworkCompany($user, $company);
    }

    public function updateNetwork(User $user, Company $company): bool
    {
        return $this->managesNetworkCompany($user, $company);
    }

    public function deleteNetwork(User $user, Company $company): bool
    {
        return $this->managesNetworkCompany($user, $company);
    }

    public function manageVehicles(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    private function customerWithCompany(User $user): bool
    {
        return $user->role === UserRole::Customer && $user->company_id !== null;
    }

    private function managesNetworkCompany(User $user, Company $company): bool
    {
        if (! $this->customerWithCompany($user)) {
            return false;
        }

        if ((int) $company->parent_company_id !== (int) $user->company_id) {
            return false;
        }

        $type = $company->company_type instanceof CompanyType
            ? $company->company_type
            : CompanyType::tryFrom((string) $company->company_type);

        return $type !== null && $type !== CompanyType::Broker;
    }
}

<?php

namespace App\Http\Requests\Concerns;

use App\Enums\CompanyType;
use App\Enums\UserRole;
use App\Models\Company;
use Illuminate\Validation\ValidationException;

trait AuthorizesNetworkCompany
{
    public function customerCanManageNetwork(): bool
    {
        $user = $this->user();

        return $user?->role === UserRole::Customer && $user->company_id !== null;
    }

    public function ownCompany(): Company
    {
        $user = $this->user();
        if ($user === null || $user->company_id === null) {
            throw ValidationException::withMessages([
                'company' => ['You must belong to a company.'],
            ]);
        }

        $company = Company::query()->find($user->company_id);
        if ($company === null) {
            throw ValidationException::withMessages([
                'company' => ['Company not found.'],
            ]);
        }

        return $company;
    }

    public function assertNetworkCompanyAccessible(Company $company): void
    {
        $user = $this->user();
        if ($user === null || $user->company_id === null) {
            abort(403);
        }

        if ((int) $company->parent_company_id !== (int) $user->company_id) {
            abort(404);
        }

        $type = $company->company_type instanceof CompanyType
            ? $company->company_type
            : CompanyType::tryFrom((string) $company->company_type);

        if ($type === null || $type === CompanyType::Broker) {
            abort(404);
        }
    }
}

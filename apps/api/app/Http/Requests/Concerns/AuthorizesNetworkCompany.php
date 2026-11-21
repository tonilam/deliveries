<?php

namespace App\Http\Requests\Concerns;

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
}

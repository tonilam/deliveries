<?php

namespace App\Http\Requests\Concerns;

use App\Enums\UserRole;
use App\Models\RateCard;

trait AuthorizesCompanyRateCard
{
    protected function customerCanManageCompanyRateCards(): bool
    {
        $user = $this->user();

        return $user?->role === UserRole::Customer && $user->company_id !== null;
    }

    protected function customerCanAccessCompanyRateCard(?RateCard $rateCard = null): bool
    {
        if (! $this->customerCanManageCompanyRateCards()) {
            return false;
        }

        return $rateCard !== null;
    }

    protected function routeRateCard(): ?RateCard
    {
        $rateCard = $this->route('rateCard');

        return $rateCard instanceof RateCard ? $rateCard : null;
    }
}

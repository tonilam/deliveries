<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\RateCard;
use App\Models\User;

class RateCardPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function create(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function view(User $user, RateCard $rateCard): bool
    {
        return $this->ownsRateCard($user, $rateCard);
    }

    public function update(User $user, RateCard $rateCard): bool
    {
        return $this->ownsRateCard($user, $rateCard);
    }

    private function customerWithCompany(User $user): bool
    {
        return $user->role === UserRole::Customer && $user->company_id !== null;
    }

    private function ownsRateCard(User $user, RateCard $rateCard): bool
    {
        if (! $this->customerWithCompany($user)) {
            return false;
        }

        return (int) $rateCard->company_id === (int) $user->company_id;
    }
}

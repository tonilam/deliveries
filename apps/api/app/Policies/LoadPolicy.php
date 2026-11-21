<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Load;
use App\Models\User;

class LoadPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function create(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function view(User $user, Load $load): bool
    {
        return $this->ownsLoad($user, $load);
    }

    public function update(User $user, Load $load): bool
    {
        return $this->ownsLoad($user, $load);
    }

    public function delete(User $user, Load $load): bool
    {
        return $this->ownsLoad($user, $load);
    }

    private function customerWithCompany(User $user): bool
    {
        return $user->role === UserRole::Customer && $user->company_id !== null;
    }

    private function ownsLoad(User $user, Load $load): bool
    {
        if (! $this->customerWithCompany($user)) {
            return false;
        }

        return (int) $load->company_id === (int) $user->company_id;
    }
}

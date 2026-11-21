<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Address;
use App\Models\User;

class AddressPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function create(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function view(User $user, Address $address): bool
    {
        return $this->ownsAddress($user, $address);
    }

    public function update(User $user, Address $address): bool
    {
        return $this->ownsAddress($user, $address);
    }

    public function delete(User $user, Address $address): bool
    {
        return $this->ownsAddress($user, $address);
    }

    private function customerWithCompany(User $user): bool
    {
        return $user->role === UserRole::Customer && $user->company_id !== null;
    }

    private function ownsAddress(User $user, Address $address): bool
    {
        if (! $this->customerWithCompany($user)) {
            return false;
        }

        return (int) $address->company_id === (int) $user->company_id;
    }
}

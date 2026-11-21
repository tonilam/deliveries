<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Item;
use App\Models\User;

class ItemPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function create(User $user): bool
    {
        return $this->customerWithCompany($user);
    }

    public function view(User $user, Item $item): bool
    {
        return $this->ownsItem($user, $item);
    }

    public function update(User $user, Item $item): bool
    {
        return $this->ownsItem($user, $item);
    }

    public function delete(User $user, Item $item): bool
    {
        return $this->ownsItem($user, $item);
    }

    private function customerWithCompany(User $user): bool
    {
        return $user->role === UserRole::Customer && $user->company_id !== null;
    }

    private function ownsItem(User $user, Item $item): bool
    {
        if (! $this->customerWithCompany($user)) {
            return false;
        }

        return (int) $item->company_id === (int) $user->company_id;
    }
}

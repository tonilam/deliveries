<?php

namespace App\Http\Requests\Concerns;

use App\Enums\UserRole;
use App\Models\Address;

trait AuthorizesCompanyAddress
{
    protected function customerCanAccessCompanyAddress(?Address $address = null): bool
    {
        $user = $this->user();
        if ($user?->role !== UserRole::Customer || $user->company_id === null) {
            return false;
        }

        return $address !== null;
    }

    protected function routeAddress(): ?Address
    {
        $address = $this->route('address');

        return $address instanceof Address ? $address : null;
    }
}

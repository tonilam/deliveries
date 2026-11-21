<?php

namespace App\Enums;

enum RateCardUserType: string
{
    case Customer = 'customer';
    case Provider = 'provider';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::Provider => 'Provider',
        };
    }
}

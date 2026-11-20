<?php

namespace App\Enums;

enum FeatureKey: string
{
    case UserRegistration = 'user_registration';

    public function name(): string
    {
        return match ($this) {
            self::UserRegistration => 'User registration',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::UserRegistration => 'Allow new users to create accounts with email/password or SSO.',
        };
    }
}

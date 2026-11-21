<?php

namespace App\Enums;

enum CompanyType: string
{
    case Customer = 'customer';
    case Provider = 'provider';
    case Broker = 'broker';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::Provider => 'Provider',
            self::Broker => 'Broker',
        };
    }

    /**
     * @return list<self>
     */
    public static function rootOptions(): array
    {
        return [self::Customer, self::Provider, self::Broker];
    }

    /**
     * @return list<self>
     */
    public static function linkedOptions(): array
    {
        return [self::Customer, self::Provider];
    }

    /**
     * @return list<self>
     */
    public function allowedChildTypes(): array
    {
        return match ($this) {
            self::Customer => [self::Provider],
            self::Provider => [self::Customer],
            self::Broker => [self::Customer, self::Provider],
        };
    }

    public function allowsNetworkTab(self $childType): bool
    {
        return in_array($childType, $this->allowedChildTypes(), true);
    }
}

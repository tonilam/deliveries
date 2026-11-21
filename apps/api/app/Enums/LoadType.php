<?php

namespace App\Enums;

enum LoadType: string
{
    case Direct = 'direct';
    case AddDrop = 'add_drop';
    case XDock = 'x_dock';

    public function label(): string
    {
        return match ($this) {
            self::Direct => 'Direct',
            self::AddDrop => 'Add Drop',
            self::XDock => 'X Dock',
        };
    }

    /**
     * @return list<self>
     */
    public static function childTypes(): array
    {
        return [self::AddDrop, self::XDock];
    }
}

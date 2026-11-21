<?php

namespace App\Enums;

enum VehicleBodyTypeCapacityUnit: string
{
    case Pallet = 'pallet';
    case M3 = 'm3';
    case Tonne = 'tonne';
    case Litre = 'litre';
    case Head = 'head';
}

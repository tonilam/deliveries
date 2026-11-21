<?php

namespace Database\Factories;

use App\Enums\VehicleBodyTypeOptionDataType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VehicleBodyTypeOption>
 */
class VehicleBodyTypeOptionFactory extends Factory
{
    protected $model = VehicleBodyTypeOption::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'vehicle_body_type_id' => VehicleBodyType::factory(),
            'key' => 'mezzanine',
            'label' => 'Mezzanine',
            'data_type' => VehicleBodyTypeOptionDataType::Boolean,
            'visibility' => VehicleBodyTypeOptionVisibility::Public,
            'required' => true,
            'sort_order' => 0,
        ];
    }
}

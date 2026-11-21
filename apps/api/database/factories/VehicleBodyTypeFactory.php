<?php

namespace Database\Factories;

use App\Enums\VehicleBodyTypeCapacityUnit;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VehicleBodyType>
 */
class VehicleBodyTypeFactory extends Factory
{
    protected $model = VehicleBodyType::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'vehicle_category_id' => VehicleCategory::factory(),
            'name' => 'Tautliner',
            'code' => 'tautliner',
            'capacity' => 22,
            'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
            'pallet_spaces' => 22,
            'cubic_metres' => 80,
            'payload_kg' => 22000,
            'description' => null,
            'option_values' => [],
        ];
    }
}

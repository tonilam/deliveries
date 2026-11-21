<?php

namespace Database\Factories;

use App\Models\VehicleCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VehicleCategory>
 */
class VehicleCategoryFactory extends Factory
{
    protected $model = VehicleCategory::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $code = fake()->unique()->regexify('[a-z]{2,12}');

        return [
            'name' => ucfirst($code).' category',
            'code' => $code,
            'sort_order' => fake()->numberBetween(0, 100),
        ];
    }
}

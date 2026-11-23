<?php

namespace Database\Factories;

use App\Enums\ItemDisplayUnit;
use App\Models\Company;
use App\Models\GoodType;
use App\Models\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Item>
 */
class ItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'good_type_code' => fn () => GoodType::factory()->create()->code,
            'weight_tonnes' => fake()->randomFloat(6, 0.001, 50),
            'quantity' => fake()->numberBetween(1, 20),
            'display_unit' => fake()->randomElement(ItemDisplayUnit::cases()),
            'order_number' => fake()->optional(0.7)->bothify('ORD-####'),
            'connote' => fake()->optional(0.5)->bothify('CN-######'),
        ];
    }
}

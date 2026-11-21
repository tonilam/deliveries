<?php

namespace Database\Factories;

use App\Models\GoodType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GoodType>
 */
class GoodTypeFactory extends Factory
{
    protected $model = GoodType::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->lexify('???')),
            'name' => fake()->words(2, true),
            'refrigerated_required' => false,
        ];
    }

    public function refrigerated(): static
    {
        return $this->state(fn () => ['refrigerated_required' => true]);
    }
}

<?php

namespace Database\Factories;

use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CountryState>
 */
class CountryStateFactory extends Factory
{
    protected $model = CountryState::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'country_id' => Country::factory(),
            'name' => fake()->unique()->state(),
            'code' => strtoupper(fake()->unique()->lexify('???')),
        ];
    }
}

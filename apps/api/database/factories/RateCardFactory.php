<?php

namespace Database\Factories;

use App\Enums\RateCardUserType;
use App\Models\Company;
use App\Models\RateCard;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RateCard>
 */
class RateCardFactory extends Factory
{
    protected $model = RateCard::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'profile_name' => fake()->unique()->words(3, true),
            'user_type' => fake()->randomElement(RateCardUserType::cases()),
            'minimum_price' => fake()->randomFloat(2, 0, 500),
            'is_active' => true,
        ];
    }
}

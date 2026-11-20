<?php

namespace Database\Factories;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Address>
 */
class AddressFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'type' => fake()->randomElement(AddressType::cases()),
            'business_name' => fake()->company(),
            'address' => fake()->streetAddress(),
            'zone' => fake()->city(),
            'state' => fake()->randomElement(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']),
            'postcode' => (string) fake()->numberBetween(1000, 9999),
        ];
    }

    public function collection(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => AddressType::Collection,
        ]);
    }

    public function delivery(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => AddressType::Delivery,
        ]);
    }
}

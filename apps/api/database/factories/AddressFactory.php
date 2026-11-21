<?php

namespace Database\Factories;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Zone;
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
            'zone_id' => function (array $attributes) {
                $companyId = $attributes['company_id'];
                if ($companyId instanceof Company) {
                    $companyId = $companyId->id;
                }

                $countryId = Company::query()->whereKey($companyId)->value('country_id');
                if (! is_numeric($countryId)) {
                    return Zone::factory()->create()->id;
                }

                $existing = Zone::query()
                    ->where('country_id', (int) $countryId)
                    ->where('is_active', true)
                    ->inRandomOrder()
                    ->value('id');

                if ($existing !== null) {
                    return $existing;
                }

                return Zone::factory()->create(['country_id' => (int) $countryId])->id;
            },
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

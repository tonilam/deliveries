<?php

namespace Database\Factories;

use App\Enums\LoadType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Load;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Load>
 */
class LoadFactory extends Factory
{
    protected $model = Load::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'parent_load_id' => null,
            'type' => LoadType::Direct,
            'customer_company_id' => Company::factory(),
            'provider_company_id' => Company::factory(),
            'secondary_provider_company_id' => null,
            'collection_address_id' => Address::factory()->collection(),
            'delivery_address_id' => Address::factory()->delivery(),
            'xdock_address_id' => null,
            'pallet_count' => fake()->numberBetween(0, 26),
        ];
    }

    public function direct(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => LoadType::Direct,
            'parent_load_id' => null,
        ]);
    }

    public function forOwner(Company $owner): static
    {
        return $this->state(fn (array $attributes) => [
            'company_id' => $owner->id,
        ]);
    }
}

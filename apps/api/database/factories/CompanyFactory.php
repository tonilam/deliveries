<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reg_number' => (string) fake()->numerify('###########'),
            'reg_type' => 'ABN',
            'business_name' => fake()->company(),
            'invoicee_name' => fake()->name(),
            'phone' => fake()->phoneNumber(),
            'email' => fake()->unique()->companyEmail(),
            'address' => fake()->streetAddress().', '.fake()->city().' NSW',
        ];
    }
}

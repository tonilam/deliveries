<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CompanyAllowedDomain;
use App\Models\Country;
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
        $domain = fake()->unique()->domainName();
        $regNumber = (string) fake()->unique()->numerify('###########');
        $businessName = trim(preg_replace('/\s+/', ' ', fake()->unique()->company()) ?? fake()->unique()->company());
        $trackingOption = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $businessName) ?? '');

        return [
            'country_id' => Country::factory(),
            'reg_number' => preg_replace('/\s+/', '', $regNumber) ?? $regNumber,
            'reg_type' => 'ABN',
            'business_name' => $businessName,
            'invoicee_name' => fake()->name(),
            'gst_rate' => 0.1,
            'tracking_option' => $trackingOption !== '' ? $trackingOption : null,
            'phone' => fake()->phoneNumber(),
            'email' => fake()->unique()->companyEmail(),
            'address' => fake()->streetAddress().', '.fake()->city().' NSW',
            'allowed_domains' => [$domain],
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Company $company): void {
            $domains = $company->allowed_domains ?? [];
            if (! is_array($domains)) {
                return;
            }

            foreach ($domains as $domain) {
                if (! is_string($domain) || $domain === '') {
                    continue;
                }

                CompanyAllowedDomain::query()->firstOrCreate([
                    'domain' => strtolower(ltrim(trim($domain), '@')),
                ], [
                    'company_id' => $company->id,
                ]);
            }
        });
    }

    /**
     * @param  list<string>  $domains
     */
    public function withDomains(array $domains): static
    {
        return $this->state(fn (array $attributes) => [
            'allowed_domains' => $domains,
        ]);
    }
}

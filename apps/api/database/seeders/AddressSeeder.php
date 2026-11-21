<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\Company;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class AddressSeeder extends Seeder
{
    /**
     * Seed random addresses for a company (default: 1 address).
     *
     * Examples:
     *   php artisan db:seed --class=AddressSeeder
     *   ADDRESS_SEED_COUNT=50 ADDRESS_SEED_COMPANY_ID=1 php artisan db:seed --class=AddressSeeder
     *   $this->callWith(AddressSeeder::class, ['count' => 50, 'companyId' => 1]);
     */
    public function run(int $count = 1, ?int $companyId = null): void
    {
        $envCount = env('ADDRESS_SEED_COUNT');
        if ($envCount !== null && $envCount !== '') {
            $count = (int) $envCount;
        }

        $envCompanyId = env('ADDRESS_SEED_COMPANY_ID');
        if ($envCompanyId !== null && $envCompanyId !== '') {
            $companyId = (int) $envCompanyId;
        }

        $count = max(0, $count);

        if ($count === 0) {
            return;
        }

        if ($companyId === null) {
            $this->command?->error('ADDRESS_SEED_COMPANY_ID (or companyId) is required.');

            return;
        }

        $company = Company::query()->find($companyId);
        if ($company === null) {
            $this->command?->error("Company {$companyId} does not exist.");

            return;
        }

        if ($company->country_id === null) {
            $this->command?->error("Company {$companyId} has no country; cannot assign zones.");

            return;
        }

        $zoneIds = Zone::query()
            ->where('country_id', $company->country_id)
            ->where('is_active', true)
            ->pluck('id')
            ->all();

        if ($zoneIds === []) {
            $this->command?->error(
                'No active zones for this company\'s country. Run AustraliaZoneSeeder / NewZealandZoneSeeder or create zones first.',
            );

            return;
        }

        for ($i = 0; $i < $count; $i++) {
            Address::factory()->create([
                'company_id' => $companyId,
                'zone_id' => $zoneIds[array_rand($zoneIds)],
            ]);
        }

        $this->command?->info("Seeded {$count} ".($count === 1 ? 'address' : 'addresses')." for company {$companyId}.");
    }
}

<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\Company;
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

        if (! Company::query()->whereKey($companyId)->exists()) {
            $this->command?->error("Company {$companyId} does not exist.");

            return;
        }

        Address::factory()
            ->count($count)
            ->create(['company_id' => $companyId]);

        $this->command?->info("Seeded {$count} ".($count === 1 ? 'address' : 'addresses')." for company {$companyId}.");
    }
}

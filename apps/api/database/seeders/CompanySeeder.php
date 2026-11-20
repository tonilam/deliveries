<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    /**
     * Seed random companies (default: 1).
     *
     * Examples:
     *   php artisan db:seed --class=CompanySeeder
     *   COMPANY_SEED_COUNT=300 php artisan db:seed --class=CompanySeeder
     *   $this->callWith(CompanySeeder::class, ['count' => 300]);
     */
    public function run(int $count = 1): void
    {
        $envCount = env('COMPANY_SEED_COUNT');
        if ($envCount !== null && $envCount !== '') {
            $count = (int) $envCount;
        }

        $count = max(0, $count);

        if ($count === 0) {
            return;
        }

        Company::factory()->count($count)->create();

        $this->command?->info("Seeded {$count} ".($count === 1 ? 'company' : 'companies').'.');
    }
}

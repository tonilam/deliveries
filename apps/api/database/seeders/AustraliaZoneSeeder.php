<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class AustraliaZoneSeeder extends Seeder
{
    /**
     * Seed Australia ABS 2021 Significant Urban Areas as zones.
     *
     * Example:
     *   php artisan db:seed --class=AustraliaZoneSeeder
     */
    public function run(): void
    {
        $country = Country::query()->where('code', 'AU')->first();
        if ($country === null) {
            $this->call(AustraliaCountrySeeder::class);
            $country = Country::query()->where('code', 'AU')->firstOrFail();
        }

        /** @var list<array{name: string, code: string}> $rows */
        $rows = require __DIR__.'/data/australia_zones.php';

        foreach ($rows as $row) {
            $zone = Zone::withTrashed()->firstOrNew([
                'country_id' => $country->id,
                'code' => $row['code'],
            ]);
            $zone->fill([
                'name' => $row['name'],
                'is_active' => true,
            ]);
            if ($zone->trashed()) {
                $zone->restore();
            }
            $zone->save();
        }

        $this->command?->info('Seeded '.count($rows).' Australian zones.');
    }
}

<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class NewZealandZoneSeeder extends Seeder
{
    /**
     * Seed New Zealand Stats NZ 2023 urban areas (10,000+ residents).
     *
     * Example:
     *   php artisan db:seed --class=NewZealandZoneSeeder
     */
    public function run(): void
    {
        $country = Country::query()->where('code', 'NZ')->first();
        if ($country === null) {
            $this->call(NewZealandCountrySeeder::class);
            $country = Country::query()->where('code', 'NZ')->firstOrFail();
        }

        /** @var list<array{name: string, code: string}> $rows */
        $rows = require __DIR__.'/data/new_zealand_zones.php';

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

        $this->command?->info('Seeded '.count($rows).' New Zealand zones.');
    }
}

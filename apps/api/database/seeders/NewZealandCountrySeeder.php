<?php

namespace Database\Seeders;

use App\Models\Country;
use Illuminate\Database\Seeder;

class NewZealandCountrySeeder extends Seeder
{
    /**
     * Seed New Zealand and its regions.
     *
     * Example:
     *   php artisan db:seed --class=NewZealandCountrySeeder
     */
    public function run(): void
    {
        $country = Country::query()->updateOrCreate(
            ['code' => 'NZ'],
            ['name' => 'New Zealand'],
        );

        $states = [
            ['code' => 'NTL', 'name' => 'Northland'],
            ['code' => 'AUK', 'name' => 'Auckland'],
            ['code' => 'WKO', 'name' => 'Waikato'],
            ['code' => 'BOP', 'name' => 'Bay of Plenty'],
            ['code' => 'GIS', 'name' => 'Gisborne'],
            ['code' => 'HKB', 'name' => "Hawke's Bay"],
            ['code' => 'TKI', 'name' => 'Taranaki'],
            ['code' => 'MWT', 'name' => 'Manawatū-Whanganui'],
            ['code' => 'WGN', 'name' => 'Wellington'],
            ['code' => 'TAS', 'name' => 'Tasman'],
            ['code' => 'NSN', 'name' => 'Nelson'],
            ['code' => 'MBH', 'name' => 'Marlborough'],
            ['code' => 'WTC', 'name' => 'West Coast'],
            ['code' => 'CAN', 'name' => 'Canterbury'],
            ['code' => 'OTA', 'name' => 'Otago'],
            ['code' => 'STL', 'name' => 'Southland'],
        ];

        foreach ($states as $state) {
            $country->states()->updateOrCreate(
                ['code' => $state['code']],
                ['name' => $state['name']],
            );
        }

        $this->command?->info('Seeded New Zealand and '.count($states).' regions.');
    }
}

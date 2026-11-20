<?php

namespace Database\Seeders;

use App\Models\Country;
use Illuminate\Database\Seeder;

class AustraliaCountrySeeder extends Seeder
{
    /**
     * Seed Australia and its states/territories.
     *
     * Example:
     *   php artisan db:seed --class=AustraliaCountrySeeder
     */
    public function run(): void
    {
        $country = Country::query()->updateOrCreate(
            ['code' => 'AU'],
            ['name' => 'Australia'],
        );

        $states = [
            ['code' => 'NSW', 'name' => 'New South Wales'],
            ['code' => 'VIC', 'name' => 'Victoria'],
            ['code' => 'QLD', 'name' => 'Queensland'],
            ['code' => 'WA', 'name' => 'Western Australia'],
            ['code' => 'SA', 'name' => 'South Australia'],
            ['code' => 'TAS', 'name' => 'Tasmania'],
            ['code' => 'ACT', 'name' => 'Australian Capital Territory'],
            ['code' => 'NT', 'name' => 'Northern Territory'],
        ];

        foreach ($states as $state) {
            $country->states()->updateOrCreate(
                ['code' => $state['code']],
                ['name' => $state['name']],
            );
        }

        $this->command?->info('Seeded Australia and '.count($states).' states/territories.');
    }
}

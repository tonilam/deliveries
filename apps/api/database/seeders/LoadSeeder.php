<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Models\Address;
use App\Models\Company;
use App\Models\GoodType;
use App\Models\Item;
use App\Models\Load;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class LoadSeeder extends Seeder
{
    /**
     * Seed demo loads for the current week (Monday–Friday).
     *
     * Examples:
     *   php artisan db:seed --class=GoodTypeSeeder
     *   php artisan db:seed --class=LoadSeeder
     *   LOAD_SEED_COUNT=30 LOAD_SEED_COMPANY_ID=1 php artisan db:seed --class=LoadSeeder
     *   $this->callWith(LoadSeeder::class, ['count' => 30, 'companyId' => 1]);
     */
    public function run(int $count = 15, ?int $companyId = null): void
    {
        $envCount = env('LOAD_SEED_COUNT');
        if ($envCount !== null && $envCount !== '') {
            $count = (int) $envCount;
        }

        $envCompanyId = env('LOAD_SEED_COMPANY_ID');
        if ($envCompanyId !== null && $envCompanyId !== '') {
            $companyId = (int) $envCompanyId;
        }

        $count = max(0, $count);

        if ($count === 0) {
            return;
        }

        if ($companyId === null) {
            $this->command?->error('LOAD_SEED_COMPANY_ID (or companyId) is required.');

            return;
        }

        $owner = Company::query()->find($companyId);
        if ($owner === null) {
            $this->command?->error("Company {$companyId} does not exist.");

            return;
        }

        $this->call(GoodTypeSeeder::class);

        [$customerId, $providerId, $providerIds] = $this->resolveParties($owner);
        if ($customerId === null || $providerId === null) {
            $this->command?->error(
                "Company {$companyId} needs at least one linked customer and one linked provider in its network.",
            );

            return;
        }

        $collectionAddressId = $this->resolveAddressId($owner, AddressType::Collection);
        if ($collectionAddressId === null) {
            $this->command?->error(
                "Company {$companyId} needs at least one collection address (or a country with zones so one can be created).",
            );

            return;
        }

        $goodTypeCodes = GoodType::query()->pluck('code')->all();
        if ($goodTypeCodes === []) {
            $this->command?->error('No goods types available after GoodTypeSeeder.');

            return;
        }

        $weekStart = now()->startOfWeek(Carbon::MONDAY)->startOfDay();
        $weekEnd = $weekStart->copy()->addDays(4);

        $scenarios = ['direct', 'add_drop', 'x_dock', 'add_drop_x_dock'];
        $createdParents = 0;

        for ($i = 0; $i < $count; $i++) {
            $scenario = $scenarios[array_rand($scenarios)];
            $schedule = $this->randomWeekdaySchedule($weekStart, $weekEnd, $i % 5);

            $parent = Load::query()->create([
                'company_id' => $owner->id,
                'parent_load_id' => null,
                'type' => LoadType::Direct,
                'customer_company_id' => $customerId,
                'provider_company_id' => $providerId,
                'secondary_provider_company_id' => null,
                'collection_address_id' => $collectionAddressId,
                'delivery_address_id' => $this->randomDeliveryAddressId($owner),
                'xdock_address_id' => null,
                'pallet_count' => random_int(1, 12),
                ...$schedule,
            ]);

            $this->seedItemsForLoad($parent, $owner, $goodTypeCodes);

            if ($scenario === 'add_drop') {
                $this->seedAddDropChildren($parent, $owner, $providerId, $schedule, $goodTypeCodes, random_int(1, 2));
            } elseif ($scenario === 'x_dock') {
                $this->seedXDockChildren($parent, $owner, $providerIds, $schedule, $goodTypeCodes, random_int(1, 5));
            } elseif ($scenario === 'add_drop_x_dock') {
                $this->seedAddDropChildren($parent, $owner, $providerId, $schedule, $goodTypeCodes, 1);
                $this->seedXDockChildren($parent, $owner, $providerIds, $schedule, $goodTypeCodes, random_int(1, 5));
            }

            $createdParents++;
        }

        $this->command?->info(
            "Seeded {$createdParents} direct ".($createdParents === 1 ? 'load' : 'loads')
            ." for company {$companyId} (pickup {$weekStart->toDateString()}–{$weekEnd->toDateString()}).",
        );
    }

    /**
     * @return array{0: ?int, 1: ?int, 2: list<int>}
     */
    private function resolveParties(Company $owner): array
    {
        if ($owner->company_type === CompanyType::Customer) {
            $customerId = $owner->id;
            $providerId = Company::query()
                ->where('parent_company_id', $owner->id)
                ->where('company_type', CompanyType::Provider)
                ->inRandomOrder()
                ->value('id');
            $providerIds = $providerId !== null
                ? [(int) $providerId]
                : [];

            return [$customerId, $providerId !== null ? (int) $providerId : null, $providerIds];
        }

        if ($owner->company_type === CompanyType::Provider) {
            $providerId = $owner->id;
            $customerId = Company::query()
                ->where('parent_company_id', $owner->id)
                ->where('company_type', CompanyType::Customer)
                ->inRandomOrder()
                ->value('id');

            return [
                $customerId !== null ? (int) $customerId : null,
                $providerId,
                [$providerId],
            ];
        }

        $customerId = Company::query()
            ->where('parent_company_id', $owner->id)
            ->where('company_type', CompanyType::Customer)
            ->inRandomOrder()
            ->value('id');
        $providerId = Company::query()
            ->where('parent_company_id', $owner->id)
            ->where('company_type', CompanyType::Provider)
            ->inRandomOrder()
            ->value('id');
        $providerIds = Company::query()
            ->where('parent_company_id', $owner->id)
            ->where('company_type', CompanyType::Provider)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();

        return [
            $customerId !== null ? (int) $customerId : null,
            $providerId !== null ? (int) $providerId : null,
            $providerIds,
        ];
    }

    private function resolveAddressId(Company $owner, AddressType $type): ?int
    {
        $existing = Address::query()
            ->where('company_id', $owner->id)
            ->where('type', $type)
            ->inRandomOrder()
            ->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        if ($owner->country_id === null) {
            return null;
        }

        $factory = $type === AddressType::Collection
            ? Address::factory()->for($owner)->collection()
            : Address::factory()->for($owner)->delivery();

        return (int) $factory->create()->id;
    }

    private function randomDeliveryAddressId(Company $owner): int
    {
        $id = $this->resolveAddressId($owner, AddressType::Delivery);

        return $id ?? (int) Address::factory()->for($owner)->delivery()->create()->id;
    }

    /**
     * @return array{pickup_date: string, pickup_time: string, dropoff_date: string, dropoff_time: string}
     */
    private function randomWeekdaySchedule(Carbon $weekStart, Carbon $weekEnd, ?int $pickupWeekdayOffset = null): array
    {
        $pickupOffset = $pickupWeekdayOffset ?? random_int(0, 4);
        $pickupOffset = max(0, min(4, $pickupOffset));
        $dropoffOffset = random_int($pickupOffset, 4);

        $pickupDate = $weekStart->copy()->addDays($pickupOffset);
        $dropoffDate = $weekStart->copy()->addDays($dropoffOffset);

        $pickupHour = random_int(6, 12);
        $pickupTime = sprintf('%02d:00', $pickupHour);

        if ($dropoffDate->equalTo($pickupDate)) {
            $dropoffHour = min(17, max($pickupHour + 1, random_int(13, 17)));
        } else {
            $dropoffHour = random_int(8, 17);
        }

        return [
            'pickup_date' => $pickupDate->toDateString(),
            'pickup_time' => $pickupTime,
            'dropoff_date' => $dropoffDate->toDateString(),
            'dropoff_time' => sprintf('%02d:00', $dropoffHour),
        ];
    }

    /**
     * @param  list<string>  $goodTypeCodes
     */
    private function seedItemsForLoad(Load $load, Company $owner, array $goodTypeCodes): void
    {
        $count = random_int(1, 5);

        for ($n = 0; $n < $count; $n++) {
            Item::factory()->create([
                'company_id' => $owner->id,
                'load_id' => $load->id,
                'good_type_code' => $goodTypeCodes[array_rand($goodTypeCodes)],
            ]);
        }
    }

    /**
     * @param  array<string, string>  $schedule
     * @param  list<string>  $goodTypeCodes
     */
    private function seedAddDropChildren(
        Load $parent,
        Company $owner,
        int $providerId,
        array $schedule,
        array $goodTypeCodes,
        int $childCount,
    ): void {
        for ($c = 0; $c < $childCount; $c++) {
            $child = Load::query()->create([
                'company_id' => $owner->id,
                'parent_load_id' => $parent->id,
                'type' => LoadType::AddDrop,
                'customer_company_id' => $parent->customer_company_id,
                'provider_company_id' => $providerId,
                'secondary_provider_company_id' => null,
                'collection_address_id' => $parent->collection_address_id,
                'delivery_address_id' => $this->randomDeliveryAddressId($owner),
                'xdock_address_id' => null,
                'pallet_count' => random_int(1, 8),
                ...$schedule,
            ]);

            $this->seedItemsForLoad($child, $owner, $goodTypeCodes);
        }
    }

    /**
     * @param  array<string, string>  $schedule
     * @param  list<int>  $providerIds
     * @param  list<string>  $goodTypeCodes
     */
    private function seedXDockChildren(
        Load $parent,
        Company $owner,
        array $providerIds,
        array $schedule,
        array $goodTypeCodes,
        int $childCount,
    ): void {
        if ($providerIds === []) {
            return;
        }

        for ($c = 0; $c < $childCount; $c++) {
            $secondaryProviderId = $providerIds[array_rand($providerIds)];

            $child = Load::query()->create([
                'company_id' => $owner->id,
                'parent_load_id' => $parent->id,
                'type' => LoadType::XDock,
                'customer_company_id' => $parent->customer_company_id,
                'provider_company_id' => $parent->provider_company_id,
                'secondary_provider_company_id' => $secondaryProviderId,
                'collection_address_id' => $parent->collection_address_id,
                'delivery_address_id' => $this->randomDeliveryAddressId($owner),
                'xdock_address_id' => $this->randomDeliveryAddressId($owner),
                'pallet_count' => random_int(1, 8),
                ...$schedule,
            ]);

            $this->seedItemsForLoad($child, $owner, $goodTypeCodes);
        }
    }
}

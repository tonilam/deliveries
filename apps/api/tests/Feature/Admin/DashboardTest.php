<?php

namespace Tests\Feature\Admin;

use App\Models\Address;
use App\Models\Company;
use App\Models\Country;
use App\Models\Load;
use App\Models\User;
use App\Models\Zone;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_guest_cannot_view_dashboard(): void
    {
        $this->asSpa()->getJson('/api/admin/dashboard')->assertUnauthorized();
    }

    public function test_customer_cannot_view_dashboard(): void
    {
        User::factory()->create([
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/dashboard')->assertForbidden();
    }

    public function test_admin_dashboard_returns_counts_and_load_metrics(): void
    {
        CarbonImmutable::setTestNow('2026-11-22 12:00:00');

        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        User::factory()->create(['email' => 'customer-user@example.com']);
        Company::factory()->count(3)->create();

        $country = Country::factory()->create();
        $zone = Zone::factory()->create(['country_id' => $country->id]);
        $owner = Company::factory()->create(['country_id' => $country->id]);

        $from = Address::factory()->for($owner)->create([
            'type' => 'collection',
            'state' => 'NSW',
            'zone_id' => $zone->id,
        ]);
        $to = Address::factory()->for($owner)->create([
            'type' => 'delivery',
            'state' => 'VIC',
            'zone_id' => $zone->id,
        ]);

        $weekStart = CarbonImmutable::parse('2026-11-17', 'UTC');
        Load::factory()->forOwner($owner)->create([
            'collection_address_id' => $from->id,
            'delivery_address_id' => $to->id,
            'customer_company_id' => $owner->id,
            'provider_company_id' => $owner->id,
            'pickup_date' => $weekStart->toDateString(),
        ]);
        Load::factory()->forOwner($owner)->create([
            'collection_address_id' => $from->id,
            'delivery_address_id' => $to->id,
            'customer_company_id' => $owner->id,
            'provider_company_id' => $owner->id,
            'pickup_date' => $weekStart->addDay()->toDateString(),
        ]);

        Load::factory()->forOwner($owner)->create([
            'collection_address_id' => $from->id,
            'delivery_address_id' => $to->id,
            'customer_company_id' => $owner->id,
            'provider_company_id' => $owner->id,
            'pickup_date' => '2026-05-01',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $response = $this->asSpa()->getJson('/api/admin/dashboard')->assertOk();

        $response->assertJsonPath('user_count', 2);
        $response->assertJsonPath('company_count', 4);

        $loadsByWeek = $response->json('loads_by_week');
        $this->assertIsArray($loadsByWeek);
        $this->assertNotEmpty($loadsByWeek);

        $currentWeek = collect($loadsByWeek)->firstWhere('week_start', '2026-11-16');
        $this->assertNotNull($currentWeek);
        $this->assertSame(2, $currentWeek['count']);

        $response->assertJsonFragment([
            'from_state' => 'NSW',
            'from_country' => $country->code,
            'to_state' => 'VIC',
            'to_country' => $country->code,
            'count' => 2,
        ]);

        $weekStarts = collect($loadsByWeek)->pluck('week_start');
        $this->assertFalse($weekStarts->contains('2026-05-01'));
        $this->assertSame(0, collect($loadsByWeek)->sum('count') - $currentWeek['count']);
    }

    public function test_load_without_delivery_address_counts_for_chart_but_not_heatmap(): void
    {
        CarbonImmutable::setTestNow('2026-11-22 12:00:00');

        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $country = Country::factory()->create();
        $zone = Zone::factory()->create(['country_id' => $country->id]);
        $owner = Company::factory()->create(['country_id' => $country->id]);

        $from = Address::factory()->for($owner)->create([
            'type' => 'collection',
            'state' => 'NSW',
            'zone_id' => $zone->id,
        ]);

        Load::factory()->forOwner($owner)->create([
            'collection_address_id' => $from->id,
            'delivery_address_id' => null,
            'customer_company_id' => $owner->id,
            'provider_company_id' => $owner->id,
            'pickup_date' => '2026-11-17',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $response = $this->asSpa()->getJson('/api/admin/dashboard')->assertOk();

        $this->assertSame(1, collect($response->json('loads_by_week'))->sum('count'));
        $response->assertJsonPath('state_flows', []);
    }
}

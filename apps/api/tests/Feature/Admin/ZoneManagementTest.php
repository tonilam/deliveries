<?php

namespace Tests\Feature\Admin;

use App\Models\Country;
use App\Models\User;
use App\Models\Zone;
use Database\Seeders\AustraliaCountrySeeder;
use Database\Seeders\AustraliaZoneSeeder;
use Database\Seeders\NewZealandCountrySeeder;
use Database\Seeders\NewZealandZoneSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ZoneManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_zones(): void
    {
        $this->asSpa()->getJson('/api/admin/zones')->assertUnauthorized();
    }

    public function test_customer_cannot_list_zones(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/admin/zones')->assertForbidden();
    }

    public function test_admin_can_crud_zones(): void
    {
        $this->loginAsAdmin();
        $country = Country::factory()->create(['name' => 'Australia', 'code' => 'AU']);

        $create = $this->asSpa()->postJson('/api/admin/zones', [
            'name' => 'Brisbane',
            'code' => 'bne',
            'country_id' => $country->id,
            'is_active' => true,
        ]);

        $create->assertCreated()
            ->assertJsonPath('zone.name', 'Brisbane')
            ->assertJsonPath('zone.code', 'BNE')
            ->assertJsonPath('zone.is_active', true);

        $zoneId = $create->json('zone.id');

        $this->asSpa()->getJson('/api/admin/zones')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('zones.0.code', 'BNE');

        $this->asSpa()->getJson("/api/admin/zones/{$zoneId}")
            ->assertOk()
            ->assertJsonPath('zone.code', 'BNE');

        $this->asSpa()->putJson("/api/admin/zones/{$zoneId}", [
            'name' => 'Brisbane Metro',
            'code' => 'BNE',
            'country_id' => $country->id,
            'is_active' => false,
        ])->assertOk()
            ->assertJsonPath('zone.name', 'Brisbane Metro')
            ->assertJsonPath('zone.is_active', false);

        $this->asSpa()->getJson('/api/admin/zones/options')
            ->assertOk()
            ->assertJsonCount(0, 'zones');

        $this->asSpa()->getJson("/api/admin/zones/{$zoneId}")
            ->assertOk()
            ->assertJsonPath('zone.is_active', false);

        $this->asSpa()->deleteJson("/api/admin/zones/{$zoneId}")
            ->assertNoContent();

        $this->asSpa()->getJson('/api/admin/zones')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $this->assertSoftDeleted('zones', ['id' => $zoneId]);
    }

    public function test_zone_code_is_unique_per_country(): void
    {
        $this->loginAsAdmin();
        $au = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $nz = Country::factory()->create(['code' => 'NZ', 'name' => 'New Zealand']);

        Zone::factory()->create(['country_id' => $au->id, 'code' => 'BNE', 'name' => 'Brisbane']);

        $this->asSpa()->postJson('/api/admin/zones', [
            'name' => 'Other',
            'code' => 'BNE',
            'country_id' => $au->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);

        $this->asSpa()->postJson('/api/admin/zones', [
            'name' => 'Brisbane NZ',
            'code' => 'BNE',
            'country_id' => $nz->id,
        ])->assertCreated();
    }

    public function test_cannot_delete_country_that_has_zones(): void
    {
        $this->loginAsAdmin();
        $country = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        Zone::factory()->create(['country_id' => $country->id]);

        $this->asSpa()->deleteJson("/api/admin/countries/{$country->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['country']);

        $this->assertDatabaseHas('countries', ['id' => $country->id]);
    }

    public function test_cannot_delete_country_when_only_soft_deleted_zones_remain(): void
    {
        $this->loginAsAdmin();
        $country = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $zone = Zone::factory()->create(['country_id' => $country->id]);
        $zone->delete();

        $this->asSpa()->deleteJson("/api/admin/countries/{$country->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['country']);
    }

    public function test_admin_can_recreate_zone_code_after_soft_delete(): void
    {
        $this->loginAsAdmin();
        $country = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);

        $create = $this->asSpa()->postJson('/api/admin/zones', [
            'name' => 'Mackay',
            'code' => 'MKY',
            'country_id' => $country->id,
        ])->assertCreated();

        $this->asSpa()->deleteJson('/api/admin/zones/'.$create->json('zone.id'))->assertNoContent();

        $this->asSpa()->postJson('/api/admin/zones', [
            'name' => 'Mackay',
            'code' => 'MKY',
            'country_id' => $country->id,
        ])->assertCreated()
            ->assertJsonPath('zone.code', 'MKY');
    }

    public function test_zone_options_can_filter_by_country(): void
    {
        $this->loginAsAdmin();
        $au = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $nz = Country::factory()->create(['code' => 'NZ', 'name' => 'New Zealand']);
        Zone::factory()->create(['country_id' => $au->id, 'name' => 'Sydney', 'code' => 'SYD']);
        Zone::factory()->create(['country_id' => $nz->id, 'name' => 'Auckland', 'code' => 'AKL']);
        Zone::factory()->inactive()->create(['country_id' => $au->id, 'name' => 'Old', 'code' => 'OLD']);

        $this->asSpa()->getJson('/api/admin/zones/options?country_id='.$au->id)
            ->assertOk()
            ->assertJsonCount(1, 'zones')
            ->assertJsonPath('zones.0.code', 'SYD');
    }

    public function test_australia_zone_seeder_is_idempotent(): void
    {
        $this->seed(AustraliaCountrySeeder::class);

        $this->seed(AustraliaZoneSeeder::class);
        $first = Zone::query()->whereHas('country', fn ($q) => $q->where('code', 'AU'))->count();
        $this->assertGreaterThan(50, $first);

        $this->seed(AustraliaZoneSeeder::class);
        $second = Zone::query()->whereHas('country', fn ($q) => $q->where('code', 'AU'))->count();
        $this->assertSame($first, $second);

        $brisbane = Zone::query()
            ->whereHas('country', fn ($q) => $q->where('code', 'AU'))
            ->where('code', 'BNE')
            ->first();
        $this->assertNotNull($brisbane);
        $this->assertTrue($brisbane->is_active);
    }

    public function test_new_zealand_zone_seeder_is_idempotent(): void
    {
        $this->seed(NewZealandCountrySeeder::class);

        $this->seed(NewZealandZoneSeeder::class);
        $first = Zone::query()->whereHas('country', fn ($q) => $q->where('code', 'NZ'))->count();
        $this->assertSame(43, $first);

        $this->seed(NewZealandZoneSeeder::class);
        $second = Zone::query()->whereHas('country', fn ($q) => $q->where('code', 'NZ'))->count();
        $this->assertSame($first, $second);
    }

    private function loginAsAdmin(): void
    {
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

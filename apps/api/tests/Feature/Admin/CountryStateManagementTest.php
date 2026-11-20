<?php

namespace Tests\Feature\Admin;

use App\Models\Company;
use App\Models\Country;
use App\Models\CountryState;
use App\Models\User;
use Database\Seeders\AustraliaCountrySeeder;
use Database\Seeders\NewZealandCountrySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CountryStateManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_countries(): void
    {
        $this->asSpa()->getJson('/api/admin/countries')->assertUnauthorized();
    }

    public function test_customer_cannot_list_countries(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/admin/countries')->assertForbidden();
    }

    public function test_admin_can_list_create_update_and_delete_countries_and_states(): void
    {
        $this->loginAsAdmin();

        $this->asSpa()->getJson('/api/admin/countries')
            ->assertOk()
            ->assertJsonPath('countries', []);

        $create = $this->asSpa()->postJson('/api/admin/countries', [
            'name' => 'Australia',
            'code' => 'au',
        ]);

        $create->assertCreated()
            ->assertJsonPath('country.name', 'Australia')
            ->assertJsonPath('country.code', 'AU')
            ->assertJsonPath('country.states', []);

        $countryId = $create->json('country.id');

        $stateCreate = $this->asSpa()->postJson("/api/admin/countries/{$countryId}/states", [
            'name' => 'New South Wales',
            'code' => 'nsw',
        ]);

        $stateCreate->assertCreated()
            ->assertJsonPath('state.name', 'New South Wales')
            ->assertJsonPath('state.code', 'NSW');

        $stateId = $stateCreate->json('state.id');

        $this->asSpa()->getJson('/api/admin/countries')
            ->assertOk()
            ->assertJsonCount(1, 'countries')
            ->assertJsonPath('countries.0.states.0.code', 'NSW');

        $this->asSpa()->putJson("/api/admin/countries/{$countryId}", [
            'name' => 'Australia Updated',
            'code' => 'AU',
        ])->assertOk()
            ->assertJsonPath('country.name', 'Australia Updated');

        $this->asSpa()->putJson("/api/admin/countries/{$countryId}/states/{$stateId}", [
            'name' => 'NSW',
            'code' => 'NSW',
        ])->assertOk()
            ->assertJsonPath('state.name', 'NSW');

        $this->asSpa()->deleteJson("/api/admin/countries/{$countryId}/states/{$stateId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('country_states', ['id' => $stateId]);

        $otherState = CountryState::factory()->create([
            'country_id' => $countryId,
            'code' => 'VIC',
            'name' => 'Victoria',
        ]);

        $this->asSpa()->deleteJson("/api/admin/countries/{$countryId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('countries', ['id' => $countryId]);
        $this->assertDatabaseMissing('country_states', ['id' => $otherState->id]);
    }

    public function test_cannot_delete_country_that_has_companies(): void
    {
        $this->loginAsAdmin();

        $country = Country::factory()->create([
            'name' => 'Australia',
            'code' => 'AU',
        ]);
        Company::factory()->create(['country_id' => $country->id]);

        $this->asSpa()->deleteJson("/api/admin/countries/{$country->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['country']);

        $this->assertDatabaseHas('countries', ['id' => $country->id]);
    }

    public function test_country_code_and_name_must_be_unique(): void
    {
        $this->loginAsAdmin();

        Country::factory()->create([
            'name' => 'Australia',
            'code' => 'AU',
        ]);

        $this->asSpa()->postJson('/api/admin/countries', [
            'name' => 'Australia',
            'code' => 'XX',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);

        $this->asSpa()->postJson('/api/admin/countries', [
            'name' => 'Elsewhere',
            'code' => 'AU',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_state_code_must_be_unique_per_country(): void
    {
        $this->loginAsAdmin();

        $australia = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $newZealand = Country::factory()->create(['code' => 'NZ', 'name' => 'New Zealand']);

        CountryState::factory()->create([
            'country_id' => $australia->id,
            'code' => 'TAS',
            'name' => 'Tasmania',
        ]);

        $this->asSpa()->postJson("/api/admin/countries/{$australia->id}/states", [
            'name' => 'Tasman Duplicate',
            'code' => 'TAS',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);

        $this->asSpa()->postJson("/api/admin/countries/{$newZealand->id}/states", [
            'name' => 'Tasman',
            'code' => 'TAS',
        ])->assertCreated()
            ->assertJsonPath('state.code', 'TAS');
    }

    public function test_state_routes_reject_mismatched_country(): void
    {
        $this->loginAsAdmin();

        $australia = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $newZealand = Country::factory()->create(['code' => 'NZ', 'name' => 'New Zealand']);
        $state = CountryState::factory()->create([
            'country_id' => $australia->id,
            'code' => 'NSW',
            'name' => 'New South Wales',
        ]);

        $this->asSpa()->putJson("/api/admin/countries/{$newZealand->id}/states/{$state->id}", [
            'name' => 'Hacked',
            'code' => 'NSW',
        ])->assertNotFound();

        $this->asSpa()->deleteJson("/api/admin/countries/{$newZealand->id}/states/{$state->id}")
            ->assertNotFound();
    }

    public function test_australia_and_new_zealand_seeders(): void
    {
        $this->seed(AustraliaCountrySeeder::class);
        $this->seed(NewZealandCountrySeeder::class);

        $this->assertDatabaseHas('countries', ['code' => 'AU', 'name' => 'Australia']);
        $this->assertDatabaseHas('countries', ['code' => 'NZ', 'name' => 'New Zealand']);
        $this->assertDatabaseHas('country_states', ['code' => 'NSW', 'name' => 'New South Wales']);
        $this->assertDatabaseHas('country_states', ['code' => 'AUK', 'name' => 'Auckland']);

        $this->assertSame(8, Country::query()->where('code', 'AU')->firstOrFail()->states()->count());
        $this->assertSame(16, Country::query()->where('code', 'NZ')->firstOrFail()->states()->count());

        $this->seed(AustraliaCountrySeeder::class);
        $this->assertSame(1, Country::query()->where('code', 'AU')->count());
        $this->assertSame(8, Country::query()->where('code', 'AU')->firstOrFail()->states()->count());
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

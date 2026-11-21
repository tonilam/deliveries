<?php

namespace Tests\Feature;

use App\Enums\CompanyType;
use App\Enums\RateCardUserType;
use App\Models\Company;
use App\Models\Country;
use App\Models\RateCard;
use App\Models\RateCardZone;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RateCardManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_rate_cards(): void
    {
        $this->asSpa()->getJson('/api/rate-cards')->assertUnauthorized();
    }

    public function test_admin_cannot_list_rate_cards(): void
    {
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/rate-cards')->assertForbidden();
    }

    public function test_customer_without_company_cannot_list_rate_cards(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'company_id' => null,
        ]));

        $this->asSpa()->getJson('/api/rate-cards')->assertForbidden();
    }

    public function test_customer_lists_only_company_rate_cards(): void
    {
        $company = $this->companyWithZones();
        $other = Company::factory()->create(['country_id' => $company->country_id]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        RateCard::factory()->for($company)->create(['profile_name' => 'Mine']);
        RateCard::factory()->for($other)->create(['profile_name' => 'Other']);

        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/rate-cards')
            ->assertOk()
            ->assertJsonCount(1, 'rate_cards')
            ->assertJsonPath('rate_cards.0.profile_name', 'Mine');
    }

    public function test_customer_cannot_show_other_company_rate_card(): void
    {
        $company = $this->companyWithZones();
        $other = Company::factory()->create(['country_id' => $company->country_id]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $foreign = RateCard::factory()->for($other)->create();

        $this->loginAs($customer);

        $this->asSpa()->getJson("/api/rate-cards/{$foreign->id}")->assertNotFound();
    }

    public function test_list_includes_linked_company_names(): void
    {
        $company = $this->companyWithZones();
        $partnerA = Company::factory()->create([
            'country_id' => $company->country_id,
            'business_name' => 'Alpha Haulage',
        ]);
        $partnerB = Company::factory()->create([
            'country_id' => $company->country_id,
            'business_name' => 'Beta Freight',
        ]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/rate-cards', [
            'profile_name' => 'With partners',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 0,
            'company_ids' => [$partnerA->id, $partnerB->id],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
            ],
        ])->assertCreated();

        $this->asSpa()->getJson('/api/rate-cards')
            ->assertOk()
            ->assertJsonPath('rate_cards.0.linked_companies.0', 'Alpha Haulage')
            ->assertJsonPath('rate_cards.0.linked_companies.1', 'Beta Freight');
    }

    public function test_create_rate_card_with_zones_and_companies(): void
    {
        $company = $this->companyWithZones();
        $partner = Company::factory()->create(['country_id' => $company->country_id]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/rate-cards', [
            'profile_name' => 'Metro standard',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 50,
            'is_active' => true,
            'company_ids' => [$partner->id],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 120.5,
                    'fuel_surcharge_percent' => 12.5,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('rate_card.profile_name', 'Metro standard')
            ->assertJsonPath('rate_card.customer_company_ids.0', $partner->id)
            ->assertJsonCount(1, 'rate_card.zone_rates');

        $this->assertDatabaseHas('rate_cards', [
            'company_id' => $company->id,
            'profile_name' => 'Metro standard',
        ]);
    }

    public function test_profile_name_must_be_unique_per_company(): void
    {
        $company = $this->companyWithZones();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        RateCard::factory()->for($company)->create(['profile_name' => 'Duplicate']);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/rate-cards', [
            'profile_name' => 'Duplicate',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 0,
            'company_ids' => [],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['profile_name']);
    }

    public function test_cannot_restrict_own_company(): void
    {
        $company = $this->companyWithZones();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/rate-cards', [
            'profile_name' => 'Self',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 0,
            'company_ids' => [$company->id],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['company_ids.0']);
    }

    public function test_rejects_inactive_zone(): void
    {
        $company = $this->companyWithZones();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $active = $this->zoneFor($company, 'Sydney');
        $inactive = Zone::factory()->create([
            'country_id' => $company->country_id,
            'name' => 'Inactive Zone',
            'code' => 'INZ',
            'is_active' => false,
        ]);

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/rate-cards', [
            'profile_name' => 'Bad zone',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 0,
            'company_ids' => [],
            'zone_rates' => [
                [
                    'collection_zone_id' => $active->id,
                    'delivery_zone_id' => $inactive->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['zone_rates.0.delivery_zone_id']);
    }

    public function test_rejects_duplicate_zone_lane(): void
    {
        $company = $this->companyWithZones();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/rate-cards', [
            'profile_name' => 'Dup lane',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 0,
            'company_ids' => [],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 20,
                    'fuel_surcharge_percent' => 1,
                ],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['zone_rates.1.collection_zone_id']);
    }

    public function test_switching_user_type_clears_company_restrictions(): void
    {
        $company = $this->companyWithZones();
        $partner = Company::factory()->create(['country_id' => $company->country_id]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $rateCard = RateCard::factory()->for($company)->create([
            'profile_name' => 'Switch',
            'user_type' => RateCardUserType::Customer,
        ]);
        $rateCard->restrictedCompanies()->sync([$partner->id]);
        RateCardZone::query()->create([
            'rate_card_id' => $rateCard->id,
            'collection_zone_id' => $sydney->id,
            'delivery_zone_id' => $melbourne->id,
            'base_rate' => 10,
            'fuel_surcharge_percent' => 0,
        ]);

        $this->loginAs($customer);

        $this->asSpa()->putJson("/api/rate-cards/{$rateCard->id}", [
            'profile_name' => 'Switch',
            'user_type' => RateCardUserType::Provider->value,
            'minimum_price' => 0,
            'is_active' => true,
            'company_ids' => [],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('rate_card.user_type', 'provider')
            ->assertJsonPath('rate_card.customer_company_ids', [])
            ->assertJsonPath('rate_card.provider_company_ids', []);

        $this->assertDatabaseMissing('rate_card_companies', [
            'rate_card_id' => $rateCard->id,
            'company_id' => $partner->id,
        ]);
    }

    public function test_inactive_rate_card_stays_listed_and_can_reactivate(): void
    {
        $company = $this->companyWithZones();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $sydney = $this->zoneFor($company, 'Sydney');
        $melbourne = $this->zoneFor($company, 'Melbourne');

        $rateCard = RateCard::factory()->for($company)->create([
            'profile_name' => 'Paused',
            'is_active' => false,
        ]);
        RateCardZone::query()->create([
            'rate_card_id' => $rateCard->id,
            'collection_zone_id' => $sydney->id,
            'delivery_zone_id' => $melbourne->id,
            'base_rate' => 10,
            'fuel_surcharge_percent' => 0,
        ]);

        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/rate-cards')
            ->assertOk()
            ->assertJsonPath('rate_cards.0.is_active', false);

        $this->asSpa()->putJson("/api/rate-cards/{$rateCard->id}", [
            'profile_name' => 'Paused',
            'user_type' => RateCardUserType::Customer->value,
            'minimum_price' => 0,
            'is_active' => true,
            'company_ids' => [],
            'zone_rates' => [
                [
                    'collection_zone_id' => $sydney->id,
                    'delivery_zone_id' => $melbourne->id,
                    'base_rate' => 10,
                    'fuel_surcharge_percent' => 0,
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('rate_card.is_active', true);
    }

    public function test_company_options_excludes_own_company(): void
    {
        $company = $this->companyWithZones();
        $other = Company::factory()->forNetworkOf($company, CompanyType::Provider)->create([
            'business_name' => 'Alpha Logistics',
        ]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/rate-cards/company-options?q=Al&user_type=provider')
            ->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.id', $other->id);
    }

    private function companyWithZones(): Company
    {
        $country = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);

        return Company::factory()->create(['country_id' => $country->id]);
    }

    private function zoneFor(Company $company, string $name, ?string $code = null): Zone
    {
        return Zone::factory()->create([
            'country_id' => $company->country_id,
            'name' => $name,
            'code' => $code ?? strtoupper(substr($name, 0, 3)),
            'is_active' => true,
        ]);
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

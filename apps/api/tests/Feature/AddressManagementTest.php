<?php

namespace Tests\Feature;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Country;
use App\Models\CountryState;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AddressManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_addresses(): void
    {
        $this->asSpa()->getJson('/api/addresses')->assertUnauthorized();
    }

    public function test_guest_cannot_create_address(): void
    {
        $this->asSpa()->postJson('/api/addresses', $this->validPayload())
            ->assertUnauthorized();
    }

    public function test_guest_cannot_show_update_or_delete_address(): void
    {
        $address = Address::factory()->create();

        $this->asSpa()->getJson("/api/addresses/{$address->id}")->assertUnauthorized();
        $this->asSpa()->putJson("/api/addresses/{$address->id}", $this->validPayload())->assertUnauthorized();
        $this->asSpa()->deleteJson("/api/addresses/{$address->id}")->assertUnauthorized();
    }

    public function test_admin_cannot_list_or_create_addresses(): void
    {
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/addresses')->assertForbidden();
        $this->asSpa()->postJson('/api/addresses', $this->validPayload())->assertForbidden();
    }

    public function test_admin_cannot_show_update_or_delete_addresses(): void
    {
        $address = Address::factory()->create();
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson("/api/addresses/{$address->id}")->assertForbidden();
        $this->asSpa()->putJson("/api/addresses/{$address->id}", $this->validPayload())->assertForbidden();
        $this->asSpa()->deleteJson("/api/addresses/{$address->id}")->assertForbidden();
    }

    public function test_customer_without_company_cannot_list_or_create_addresses(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'company_id' => null,
        ]));

        $this->asSpa()->getJson('/api/addresses')->assertForbidden();
        $this->asSpa()->postJson('/api/addresses', $this->validPayload())->assertForbidden();
    }

    public function test_customer_without_company_cannot_show_update_or_delete_addresses(): void
    {
        $address = Address::factory()->create();
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'company_id' => null,
        ]));

        $this->asSpa()->getJson("/api/addresses/{$address->id}")->assertForbidden();
        $this->asSpa()->putJson("/api/addresses/{$address->id}", $this->validPayload())->assertForbidden();
        $this->asSpa()->deleteJson("/api/addresses/{$address->id}")->assertForbidden();
    }

    public function test_customer_lists_only_company_addresses(): void
    {
        $company = Company::factory()->create();
        $otherCompany = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        Address::factory()->for($company)->collection()->create([
            'business_name' => 'Mine Pty Ltd',
            'address' => '1 Main St',
            'zone_id' => $this->zoneFor($company, 'Sydney')->id,
            'state' => 'NSW',
            'postcode' => '2000',
        ]);
        Address::factory()->for($otherCompany)->create([
            'business_name' => 'Other Co',
        ]);

        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/addresses')
            ->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.business_name', 'Mine Pty Ltd')
            ->assertJsonPath('addresses.0.type', 'collection')
            ->assertJsonPath('addresses.0.address', '1 Main St')
            ->assertJsonPath('addresses.0.zone', 'Sydney')
            ->assertJsonPath('addresses.0.state', 'NSW')
            ->assertJsonPath('addresses.0.postcode', '2000');
    }

    public function test_customer_can_create_address_for_company(): void
    {
        $company = $this->companyWithStates();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $response = $this->asSpa()->postJson('/api/addresses', [
            ...$this->validPayload($company),
            'type' => AddressType::Delivery->value,
        ]);

        $response->assertCreated()
            ->assertJsonPath('address.type', 'delivery')
            ->assertJsonPath('address.business_name', 'Acme Logistics')
            ->assertJsonPath('address.address', '42 Warehouse Rd')
            ->assertJsonPath('address.zone', 'Melbourne')
            ->assertJsonPath('address.state', 'VIC')
            ->assertJsonPath('address.postcode', '3000');

        $this->assertDatabaseHas('addresses', [
            'company_id' => $company->id,
            'type' => 'delivery',
            'business_name' => 'Acme Logistics',
            'postcode' => '3000',
        ]);
    }

    public function test_customer_can_show_company_address(): void
    {
        $company = $this->companyWithStates();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $address = Address::factory()->for($company)->collection()->create([
            'business_name' => 'Mine Pty Ltd',
            'address' => '1 Main St',
            'zone_id' => $this->zoneFor($company, 'Sydney')->id,
            'state' => 'NSW',
            'postcode' => '2000',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson("/api/addresses/{$address->id}")
            ->assertOk()
            ->assertJsonPath('address.id', $address->id)
            ->assertJsonPath('address.type', 'collection')
            ->assertJsonPath('address.business_name', 'Mine Pty Ltd')
            ->assertJsonPath('address.address', '1 Main St')
            ->assertJsonPath('address.zone', 'Sydney')
            ->assertJsonPath('address.state', 'NSW')
            ->assertJsonPath('address.postcode', '2000');
    }

    public function test_customer_cannot_show_another_company_address(): void
    {
        $company = Company::factory()->create();
        $other = Address::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson("/api/addresses/{$other->id}")->assertNotFound();
    }

    public function test_customer_can_update_company_address(): void
    {
        $company = $this->companyWithStates();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $address = Address::factory()->for($company)->collection()->create([
            'business_name' => 'Old Name',
            'address' => '1 Main St',
            'zone_id' => $this->zoneFor($company, 'Sydney')->id,
            'state' => 'NSW',
            'postcode' => '2000',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->putJson("/api/addresses/{$address->id}", [
            ...$this->validPayload($company),
            'type' => AddressType::Delivery->value,
        ])->assertOk()
            ->assertJsonPath('address.id', $address->id)
            ->assertJsonPath('address.type', 'delivery')
            ->assertJsonPath('address.business_name', 'Acme Logistics')
            ->assertJsonPath('address.address', '42 Warehouse Rd')
            ->assertJsonPath('address.zone', 'Melbourne')
            ->assertJsonPath('address.state', 'VIC')
            ->assertJsonPath('address.postcode', '3000');

        $this->assertDatabaseHas('addresses', [
            'id' => $address->id,
            'company_id' => $company->id,
            'type' => 'delivery',
            'business_name' => 'Acme Logistics',
            'postcode' => '3000',
        ]);
    }

    public function test_update_address_rejects_state_outside_company_country(): void
    {
        $company = $this->companyWithStates();
        $otherCountry = Country::factory()->create();
        CountryState::factory()->create([
            'country_id' => $otherCountry->id,
            'code' => 'AUK',
            'name' => 'Auckland',
        ]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $address = Address::factory()->for($company)->create([
            'state' => 'NSW',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->putJson("/api/addresses/{$address->id}", [
            ...$this->validPayload($company),
            'state' => 'AUK',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['state']);
    }

    public function test_customer_cannot_update_another_company_address(): void
    {
        $company = $this->companyWithStates();
        $other = Address::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->putJson("/api/addresses/{$other->id}", $this->validPayload($company))->assertNotFound();
        $this->assertDatabaseHas('addresses', [
            'id' => $other->id,
            'business_name' => $other->business_name,
        ]);
    }

    public function test_customer_can_delete_company_address(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $address = Address::factory()->for($company)->create();
        $this->loginAs($customer);

        $this->asSpa()->deleteJson("/api/addresses/{$address->id}")->assertNoContent();
        $this->assertDatabaseMissing('addresses', ['id' => $address->id]);
    }

    public function test_customer_cannot_delete_another_company_address(): void
    {
        $company = Company::factory()->create();
        $other = Address::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->deleteJson("/api/addresses/{$other->id}")->assertNotFound();
        $this->assertDatabaseHas('addresses', ['id' => $other->id]);
    }

    public function test_create_address_rejects_state_outside_company_country(): void
    {
        $company = $this->companyWithStates();
        $otherCountry = Country::factory()->create();
        CountryState::factory()->create([
            'country_id' => $otherCountry->id,
            'code' => 'AUK',
            'name' => 'Auckland',
        ]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/addresses', [
            ...$this->validPayload($company),
            'state' => 'AUK',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['state']);
    }

    public function test_create_address_rejects_zone_outside_company_country(): void
    {
        $company = $this->companyWithStates();
        $otherCountry = Country::factory()->create();
        $foreignZone = Zone::factory()->create(['country_id' => $otherCountry->id]);
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/addresses', [
            ...$this->validPayload($company),
            'zone_id' => $foreignZone->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['zone_id']);
    }

    public function test_customer_can_list_state_options_for_company_country(): void
    {
        $company = $this->companyWithStates();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/addresses/state-options')
            ->assertOk()
            ->assertJsonCount(2, 'states')
            ->assertJsonPath('states.0.code', 'NSW')
            ->assertJsonPath('states.0.name', 'New South Wales')
            ->assertJsonPath('states.1.code', 'VIC')
            ->assertJsonPath('states.1.name', 'Victoria');
    }

    public function test_admin_and_guest_cannot_list_state_options(): void
    {
        $this->asSpa()->getJson('/api/addresses/state-options')->assertUnauthorized();

        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/addresses/state-options')->assertForbidden();
    }

    public function test_customer_can_list_zone_options_for_company_country(): void
    {
        $company = $this->companyWithStates();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/addresses/zone-options')
            ->assertOk()
            ->assertJsonCount(2, 'zones')
            ->assertJsonPath('zones.0.name', 'Melbourne')
            ->assertJsonPath('zones.1.name', 'Sydney');
    }

    public function test_admin_and_guest_cannot_list_zone_options(): void
    {
        $this->asSpa()->getJson('/api/addresses/zone-options')->assertUnauthorized();

        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/addresses/zone-options')->assertForbidden();
    }

    public function test_create_address_validates_required_fields_and_type(): void
    {
        $this->loginAs(User::factory()->forCompany()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->postJson('/api/addresses', [
            'type' => 'pickup',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors([
                'type',
                'business_name',
                'address',
                'zone_id',
                'state',
                'postcode',
            ]);
    }

    public function test_address_list_is_paginated(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        Address::factory()->for($company)->count(30)->create();
        $this->loginAs($customer);

        $default = $this->asSpa()->getJson('/api/addresses');
        $default->assertOk()
            ->assertJsonCount(25, 'addresses')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 25)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.from', 1)
            ->assertJsonPath('meta.to', 25);

        $pageTwo = $this->asSpa()->getJson('/api/addresses?page=2&per_page=10');
        $pageTwo->assertOk()
            ->assertJsonCount(10, 'addresses')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.from', 11)
            ->assertJsonPath('meta.to', 20);

        $this->asSpa()->getJson('/api/addresses?per_page=15')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $this->asSpa()->getJson('/api/addresses?page=99&per_page=10')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonCount(10, 'addresses');
    }

    public function test_address_list_supports_server_side_filters(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        Address::factory()->for($company)->collection()->create([
            'business_name' => 'Alpha Yard',
            'address' => '1 Alpha St',
            'zone_id' => $this->zoneFor($company, 'Sydney')->id,
            'state' => 'NSW',
            'postcode' => '2000',
        ]);
        Address::factory()->for($company)->delivery()->create([
            'business_name' => 'Beta Depot',
            'address' => '2 Beta Rd',
            'zone_id' => $this->zoneFor($company, 'Melbourne')->id,
            'state' => 'VIC',
            'postcode' => '3000',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'business_name' => [
                    'type' => 'contains',
                    'filter' => 'Alpha',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.business_name', 'Alpha Yard')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'type' => [
                    'type' => 'equals',
                    'filter' => 'Delivery',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.type', 'delivery')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'postcode' => [
                    'type' => 'greaterThan',
                    'filter' => '40',
                ],
            ],
        ]))->assertOk();

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'postcode' => [
                    'type' => 'greaterThan',
                    'filter' => '2500',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.postcode', '3000')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'postcode' => [
                    'type' => 'lessThan',
                    'filter' => '2500',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.postcode', '2000')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'state' => [
                    'type' => 'equals',
                    'filter' => 'NSW',
                ],
            ],
            'per_page' => 10,
        ]))->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.state', 'NSW');

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'filter' => [
                'business_name' => [
                    'type' => 'bogus',
                    'filter' => 'x',
                ],
            ],
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['filter.business_name.type']);
    }

    public function test_address_list_supports_search(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        Address::factory()->for($company)->collection()->create([
            'business_name' => 'Alpha Yard',
            'address' => '1 Alpha St',
            'zone_id' => $this->zoneFor($company, 'Sydney')->id,
            'state' => 'NSW',
            'postcode' => '2000',
        ]);
        Address::factory()->for($company)->delivery()->create([
            'business_name' => 'Beta Depot',
            'address' => '2 Beta Rd',
            'zone_id' => $this->zoneFor($company, 'Melbourne')->id,
            'state' => 'VIC',
            'postcode' => '3000',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/addresses?search=Alpha')
            ->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.business_name', 'Alpha Yard')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/addresses?search=Beta%20Rd')
            ->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.business_name', 'Beta Depot');

        $this->asSpa()->getJson('/api/addresses?search=Delivery')
            ->assertOk()
            ->assertJsonCount(1, 'addresses')
            ->assertJsonPath('addresses.0.type', 'delivery');

        $this->asSpa()->getJson('/api/addresses?search=')
            ->assertOk()
            ->assertJsonCount(2, 'addresses')
            ->assertJsonPath('meta.total', 2);
    }

    public function test_address_list_supports_server_side_sorting(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        Address::factory()->for($company)->create([
            'business_name' => 'Zulu Yard',
            'zone_id' => $this->zoneFor($company, 'Zeta')->id,
            'state' => 'WA',
            'postcode' => '6000',
        ]);
        Address::factory()->for($company)->create([
            'business_name' => 'Alpha Yard',
            'zone_id' => $this->zoneFor($company, 'Alpha')->id,
            'state' => 'NSW',
            'postcode' => '2000',
        ]);
        Address::factory()->for($company)->create([
            'business_name' => 'Mike Yard',
            'zone_id' => $this->zoneFor($company, 'Mike')->id,
            'state' => 'VIC',
            'postcode' => '3000',
        ]);
        $this->loginAs($customer);

        $default = $this->asSpa()->getJson('/api/addresses');
        $default->assertOk()
            ->assertJsonPath('addresses.0.business_name', 'Alpha Yard')
            ->assertJsonPath('addresses.1.business_name', 'Mike Yard')
            ->assertJsonPath('addresses.2.business_name', 'Zulu Yard');

        $byNameDesc = $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'sort' => 'business_name',
            'direction' => 'desc',
        ]));
        $byNameDesc->assertOk()
            ->assertJsonPath('addresses.0.business_name', 'Zulu Yard')
            ->assertJsonPath('addresses.2.business_name', 'Alpha Yard');

        $byZone = $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'sort' => 'zone',
            'direction' => 'asc',
            'per_page' => 10,
        ]));
        $byZone->assertOk()
            ->assertJsonPath('addresses.0.zone', 'Alpha')
            ->assertJsonPath('addresses.1.zone', 'Mike')
            ->assertJsonPath('addresses.2.zone', 'Zeta');

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'sort' => 'not_a_column',
            'direction' => 'asc',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['sort']);

        $this->asSpa()->getJson('/api/addresses?'.http_build_query([
            'sort' => 'business_name',
            'direction' => 'sideways',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['direction']);
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @return array<string, mixed>
     */
    private function validPayload(?Company $company = null): array
    {
        $company ??= Company::factory()->create();

        $zoneId = Zone::query()
            ->where('country_id', $company->country_id)
            ->where('name', 'Melbourne')
            ->value('id');

        if ($zoneId === null) {
            $zoneId = $this->zoneFor($company, 'Melbourne', 'MEL')->id;
        }

        return [
            'type' => AddressType::Collection->value,
            'business_name' => 'Acme Logistics',
            'address' => '42 Warehouse Rd',
            'zone_id' => $zoneId,
            'state' => 'VIC',
            'postcode' => '3000',
        ];
    }

    private function companyWithStates(): Company
    {
        $country = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        CountryState::factory()->create([
            'country_id' => $country->id,
            'code' => 'NSW',
            'name' => 'New South Wales',
        ]);
        CountryState::factory()->create([
            'country_id' => $country->id,
            'code' => 'VIC',
            'name' => 'Victoria',
        ]);

        $company = Company::factory()->create([
            'country_id' => $country->id,
        ]);

        $this->zoneFor($company, 'Sydney', 'SYD');
        $this->zoneFor($company, 'Melbourne', 'MEL');

        return $company;
    }

    private function zoneFor(Company $company, string $name, ?string $code = null): Zone
    {
        return Zone::factory()->create([
            'country_id' => $company->country_id,
            'name' => $name,
            'code' => $code ?? strtoupper(substr($name, 0, 3)),
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

<?php

namespace Tests\Feature;

use App\Enums\CompanyType;
use App\Models\Company;
use App\Models\Country;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkCompanyManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_network_api(): void
    {
        $this->asSpa()->getJson('/api/network/companies?network_type=customer')->assertUnauthorized();
    }

    public function test_customer_without_company_gets_forbidden(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/network/companies?network_type=customer')->assertForbidden();
    }

    public function test_broker_can_create_and_list_provider_in_network(): void
    {
        $country = Country::factory()->create();
        $parent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $customer = User::factory()->forCompany($parent)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $create = $this->asSpa()->postJson('/api/network/companies', [
            'network_type' => 'provider',
            'country_id' => $country->id,
            'reg_number' => '51824753556',
            'reg_type' => 'ABN',
            'business_name' => 'Linked Provider',
            'phone' => '0299998888',
            'email' => 'billing@provider.test',
            'address' => '1 Main St',
            'allowed_domains' => ['provider.test'],
        ]);

        $create->assertCreated()
            ->assertJsonPath('company.business_name', 'Linked Provider')
            ->assertJsonPath('company.company_type', 'provider')
            ->assertJsonPath('company.parent_company_id', $parent->id);

        $this->asSpa()->getJson('/api/network/companies?network_type=provider')
            ->assertOk()
            ->assertJsonPath('own_company_type', 'broker')
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Linked Provider');
    }

    public function test_customer_company_cannot_open_customers_tab(): void
    {
        $parent = Company::factory()->create(['company_type' => CompanyType::Customer]);
        $customer = User::factory()->forCompany($parent)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/network/companies?network_type=customer')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['network_type']);
    }

    public function test_customer_can_delete_unused_network_company(): void
    {
        $parent = Company::factory()->create(['company_type' => CompanyType::Broker]);
        $child = Company::factory()->forNetworkOf($parent, CompanyType::Provider)->withDomains(['child.test'])->create();
        $customer = User::factory()->forCompany($parent)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $this->asSpa()->deleteJson('/api/network/companies/'.$child->id)
            ->assertOk();

        $this->assertDatabaseMissing('companies', ['id' => $child->id]);
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

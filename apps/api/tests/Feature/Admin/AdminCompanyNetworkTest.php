<?php

namespace Tests\Feature\Admin;

use App\Enums\CompanyType;
use App\Models\Company;
use App\Models\Country;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCompanyNetworkTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_admin_network_api(): void
    {
        $parent = Company::factory()->create(['company_type' => CompanyType::Broker]);

        $this->asSpa()->getJson('/api/admin/companies/'.$parent->id.'/network?type=customer')
            ->assertUnauthorized();
    }

    public function test_broker_can_list_and_link_provider(): void
    {
        $country = Country::factory()->create();
        $parent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $candidate = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Provider,
            'business_name' => 'Orphan Provider',
        ]);
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/companies/'.$parent->id.'/network', [
            'company_id' => $candidate->id,
        ])->assertOk()
            ->assertJsonPath('company.parent_company_id', $parent->id)
            ->assertJsonPath('company.company_type', 'provider');

        $this->asSpa()->getJson('/api/admin/companies/'.$parent->id.'/network?type=provider')
            ->assertOk()
            ->assertJsonPath('parent_company_type', 'broker')
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Orphan Provider');
    }

    public function test_customer_root_cannot_list_customers_tab(): void
    {
        $parent = Company::factory()->create(['company_type' => CompanyType::Customer]);
        $this->loginAsAdmin();

        $this->asSpa()->getJson('/api/admin/companies/'.$parent->id.'/network?type=customer')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_cannot_link_company_that_already_has_parent(): void
    {
        $country = Country::factory()->create();
        $parent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $otherParent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $child = Company::factory()->forNetworkOf($otherParent, CompanyType::Provider)->create();
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/companies/'.$parent->id.'/network', [
            'company_id' => $child->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['company_id']);
    }

    public function test_cannot_link_root_with_children(): void
    {
        $country = Country::factory()->create();
        $parent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $candidateParent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Provider,
        ]);
        Company::factory()->forNetworkOf($candidateParent, CompanyType::Customer)->create();
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/companies/'.$parent->id.'/network', [
            'company_id' => $candidateParent->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['company_id']);
    }

    public function test_linked_company_cannot_manage_network(): void
    {
        $country = Country::factory()->create();
        $root = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $linked = Company::factory()->forNetworkOf($root, CompanyType::Provider)->create();
        $this->loginAsAdmin();

        $this->asSpa()->getJson('/api/admin/companies/'.$linked->id.'/network?type=customer')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company']);
    }

    public function test_candidates_exclude_linked_and_child_holders(): void
    {
        $country = Country::factory()->create();
        $parent = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Broker,
        ]);
        $eligible = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Customer,
            'business_name' => 'Eligible Customer',
        ]);
        Company::factory()->forNetworkOf($parent, CompanyType::Customer)->create();
        $withChildren = Company::factory()->create([
            'country_id' => $country->id,
            'company_type' => CompanyType::Customer,
        ]);
        Company::factory()->forNetworkOf($withChildren, CompanyType::Provider)->create();
        $this->loginAsAdmin();

        $this->asSpa()->getJson('/api/admin/companies/'.$parent->id.'/network/candidates?type=customer&search=Eligible')
            ->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.id', $eligible->id);
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

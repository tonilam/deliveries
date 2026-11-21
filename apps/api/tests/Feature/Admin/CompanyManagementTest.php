<?php

namespace Tests\Feature\Admin;

use App\Enums\CompanyType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Country;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_companies(): void
    {
        $this->asSpa()->getJson('/api/admin/companies')->assertUnauthorized();
    }

    public function test_customer_cannot_list_companies(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/admin/companies')->assertForbidden();
    }

    public function test_admin_can_list_create_and_update_companies(): void
    {
        $this->loginAsAdmin();
        $country = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);

        $this->asSpa()->getJson('/api/admin/companies')
            ->assertOk()
            ->assertJsonPath('companies', [])
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 25)
            ->assertJsonPath('meta.total', 0);

        $create = $this->asSpa()->postJson('/api/admin/companies', [
            'company_type' => 'broker',
            'country_id' => $country->id,
            'reg_number' => '51824753556',
            'reg_type' => 'ABN',
            'business_name' => 'Acme Pty Ltd',
            'phone' => '0299998888',
            'email' => 'billing@acme.test',
            'address' => '1 Main St',
            'allowed_domains' => ['Acme.TEST', '@acme.test'],
        ]);

        $create->assertCreated()
            ->assertJsonPath('company.business_name', 'Acme Pty Ltd')
            ->assertJsonPath('company.allowed_domains', ['acme.test'])
            ->assertJsonPath('company.country_id', $country->id)
            ->assertJsonPath('company.country.code', 'AU')
            ->assertJsonPath('company.company_type', 'broker')
            ->assertJsonPath('company.has_addresses', false)
            ->assertJsonPath('company.invoicee_name', '')
            ->assertJsonPath('company.gst_rate', 0.1)
            ->assertJsonPath('company.tracking_option', null);

        $id = $create->json('company.id');

        $this->asSpa()->putJson('/api/admin/companies/'.$id, [
            'section' => 'details',
            'company_type' => 'broker',
            'country_id' => $country->id,
            'reg_number' => '51824753556',
            'reg_type' => 'ABN',
            'business_name' => 'Acme Updated',
            'phone' => '0299998888',
            'email' => 'billing@acme.test',
            'address' => '1 Main St',
            'allowed_domains' => ['acme.test', 'acme.com.au'],
        ])->assertOk()
            ->assertJsonPath('company.business_name', 'Acme Updated')
            ->assertJsonPath('company.allowed_domains.1', 'acme.com.au')
            ->assertJsonPath('company.gst_rate', 0.1);

        $this->asSpa()->getJson('/api/admin/companies')
            ->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('companies.0.country.code', 'AU');
    }

    public function test_admin_can_change_company_country_when_no_addresses(): void
    {
        $australia = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $newZealand = Country::factory()->create(['code' => 'NZ', 'name' => 'New Zealand']);
        $company = Company::factory()->withDomains(['acme.test'])->create([
            'country_id' => $australia->id,
        ]);
        $this->loginAsAdmin();

        $this->asSpa()->putJson('/api/admin/companies/'.$company->id, [
            'section' => 'details',
            'company_type' => 'broker',
            'country_id' => $newZealand->id,
            'reg_number' => $company->reg_number,
            'reg_type' => $company->reg_type,
            'business_name' => $company->business_name,
            'phone' => $company->phone,
            'email' => $company->email,
            'address' => $company->address,
            'allowed_domains' => ['acme.test'],
        ])->assertOk()
            ->assertJsonPath('company.country_id', $newZealand->id)
            ->assertJsonPath('company.country.code', 'NZ');
    }

    public function test_admin_cannot_change_company_country_when_addresses_exist(): void
    {
        $australia = Country::factory()->create(['code' => 'AU', 'name' => 'Australia']);
        $newZealand = Country::factory()->create(['code' => 'NZ', 'name' => 'New Zealand']);
        $company = Company::factory()->withDomains(['acme.test'])->create([
            'country_id' => $australia->id,
        ]);
        Address::factory()->for($company)->create();
        $this->loginAsAdmin();

        $this->asSpa()->putJson('/api/admin/companies/'.$company->id, [
            'section' => 'details',
            'company_type' => 'broker',
            'country_id' => $newZealand->id,
            'reg_number' => $company->reg_number,
            'reg_type' => $company->reg_type,
            'business_name' => $company->business_name,
            'phone' => $company->phone,
            'email' => $company->email,
            'address' => $company->address,
            'allowed_domains' => ['acme.test'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['country_id']);

        $this->asSpa()->getJson('/api/admin/companies/'.$company->id)
            ->assertOk()
            ->assertJsonPath('company.country_id', $australia->id)
            ->assertJsonPath('company.has_addresses', true);
    }

    public function test_admin_company_list_is_paginated(): void
    {
        $this->loginAsAdmin();

        Company::factory()->count(30)->create();

        $default = $this->asSpa()->getJson('/api/admin/companies');
        $default->assertOk()
            ->assertJsonCount(25, 'companies')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 25)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.from', 1)
            ->assertJsonPath('meta.to', 25);

        $pageTwo = $this->asSpa()->getJson('/api/admin/companies?page=2&per_page=10');
        $pageTwo->assertOk()
            ->assertJsonCount(10, 'companies')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.from', 11)
            ->assertJsonPath('meta.to', 20);

        $this->asSpa()->getJson('/api/admin/companies?per_page=15')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $this->asSpa()->getJson('/api/admin/companies?page=99&per_page=10')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonCount(10, 'companies');
    }

    public function test_admin_company_list_supports_server_side_filters(): void
    {
        $this->loginAsAdmin();

        Company::factory()->withDomains(['alpha.test'])->create([
            'business_name' => 'Alpha Logistics',
            'reg_number' => '11111111111',
            'email' => 'ops@alpha.test',
        ]);
        Company::factory()->withDomains(['beta.test'])->create([
            'business_name' => 'Beta Freight',
            'reg_number' => '22222222222',
            'email' => 'hello@beta.test',
        ]);
        Company::factory()->withDomains(['shared.example'])->create([
            'business_name' => 'Shared Haulage',
            'reg_number' => '33333333333',
            'email' => 'team@shared.example',
        ]);

        $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'filter' => [
                'business_name' => [
                    'type' => 'contains',
                    'filter' => 'Alpha',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Alpha Logistics')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'filter' => [
                'allowed_domains' => [
                    'type' => 'contains',
                    'filter' => 'beta',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Beta Freight')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'filter' => [
                'email' => [
                    'type' => 'endsWith',
                    'filter' => 'shared.example',
                ],
            ],
            'per_page' => 10,
        ]))->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.email', 'team@shared.example');

        $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'filter' => [
                'business_name' => [
                    'type' => 'bogus',
                    'filter' => 'x',
                ],
            ],
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['filter.business_name.type']);
    }

    public function test_admin_company_list_supports_search(): void
    {
        $this->loginAsAdmin();

        Company::factory()->withDomains(['alpha.test'])->create([
            'business_name' => 'Alpha Logistics',
            'reg_number' => '11111111111',
            'email' => 'ops@alpha.test',
        ]);
        Company::factory()->withDomains(['shared.example'])->create([
            'business_name' => 'Beta Freight',
            'reg_number' => '22222222222',
            'email' => 'team@shared.example',
        ]);

        $this->asSpa()->getJson('/api/admin/companies?search=Alpha')
            ->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Alpha Logistics');

        $this->asSpa()->getJson('/api/admin/companies?search=shared.example')
            ->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Beta Freight');

        $this->asSpa()->getJson('/api/admin/companies?search=')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_admin_company_list_supports_server_side_sorting(): void
    {
        $this->loginAsAdmin();

        Company::factory()->withDomains(['zeta.test'])->create([
            'business_name' => 'Zulu Transport',
            'reg_number' => '11111111111',
            'email' => 'z@example.test',
        ]);
        Company::factory()->withDomains(['alpha.test'])->create([
            'business_name' => 'Alpha Logistics',
            'reg_number' => '33333333333',
            'email' => 'a@example.test',
        ]);
        Company::factory()->withDomains(['mike.test'])->create([
            'business_name' => 'Mike Haulage',
            'reg_number' => '22222222222',
            'email' => 'm@example.test',
        ]);

        $default = $this->asSpa()->getJson('/api/admin/companies');
        $default->assertOk()
            ->assertJsonPath('companies.0.business_name', 'Alpha Logistics')
            ->assertJsonPath('companies.1.business_name', 'Mike Haulage')
            ->assertJsonPath('companies.2.business_name', 'Zulu Transport');

        $byNameDesc = $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'sort' => 'business_name',
            'direction' => 'desc',
        ]));
        $byNameDesc->assertOk()
            ->assertJsonPath('companies.0.business_name', 'Zulu Transport')
            ->assertJsonPath('companies.2.business_name', 'Alpha Logistics');

        $byEmail = $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'sort' => 'email',
            'direction' => 'asc',
            'per_page' => 10,
        ]));
        $byEmail->assertOk()
            ->assertJsonPath('companies.0.email', 'a@example.test')
            ->assertJsonPath('companies.1.email', 'm@example.test')
            ->assertJsonPath('companies.2.email', 'z@example.test');

        $byDomains = $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'sort' => 'allowed_domains',
            'direction' => 'asc',
        ]));
        $byDomains->assertOk()
            ->assertJsonPath('companies.0.business_name', 'Alpha Logistics')
            ->assertJsonPath('companies.1.business_name', 'Mike Haulage')
            ->assertJsonPath('companies.2.business_name', 'Zulu Transport');

        $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'sort' => 'not_a_column',
            'direction' => 'asc',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['sort']);

        $this->asSpa()->getJson('/api/admin/companies?'.http_build_query([
            'sort' => 'business_name',
            'direction' => 'sideways',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['direction']);
    }

    public function test_admin_can_update_company_finance_fields(): void
    {
        $company = Company::factory()->withDomains(['acme.test'])->create([
            'invoicee_name' => '',
            'gst_rate' => 0.1,
            'tracking_option' => null,
            'business_name' => 'Keep Details Co',
        ]);
        $this->loginAsAdmin();

        $this->asSpa()->putJson('/api/admin/companies/'.$company->id, [
            'section' => 'finance',
            'invoicee_name' => 'Billing Desk',
            'gst_rate' => 0.15,
            'tracking_option' => 'Department A',
        ])->assertOk()
            ->assertJsonPath('company.invoicee_name', 'Billing Desk')
            ->assertJsonPath('company.gst_rate', 0.15)
            ->assertJsonPath('company.tracking_option', 'Department A')
            ->assertJsonPath('company.business_name', 'Keep Details Co');
    }

    public function test_details_update_does_not_overwrite_finance_fields(): void
    {
        $company = Company::factory()->withDomains(['acme.test'])->create([
            'invoicee_name' => 'Billing Desk',
            'gst_rate' => 0.15,
            'tracking_option' => 'Department A',
        ]);
        $this->loginAsAdmin();

        $this->asSpa()->putJson('/api/admin/companies/'.$company->id, [
            'section' => 'details',
            'company_type' => 'broker',
            'country_id' => $company->country_id,
            'reg_number' => $company->reg_number,
            'reg_type' => $company->reg_type,
            'business_name' => 'Renamed Co',
            'phone' => $company->phone,
            'email' => $company->email,
            'address' => $company->address,
            'allowed_domains' => ['acme.test'],
        ])->assertOk()
            ->assertJsonPath('company.business_name', 'Renamed Co')
            ->assertJsonPath('company.invoicee_name', 'Billing Desk')
            ->assertJsonPath('company.gst_rate', 0.15)
            ->assertJsonPath('company.tracking_option', 'Department A');
    }

    public function test_allowed_domain_cannot_be_shared_across_companies(): void
    {
        Company::factory()->withDomains(['shared.test'])->create();
        $this->loginAsAdmin();
        $country = Country::factory()->create();

        $this->asSpa()->postJson('/api/admin/companies', [
            'company_type' => 'broker',
            'country_id' => $country->id,
            'reg_number' => '111',
            'reg_type' => 'ABN',
            'business_name' => 'Other Co',
            'phone' => '02',
            'email' => 'a@other.test',
            'address' => '2 St',
            'allowed_domains' => ['shared.test'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['allowed_domains']);
    }

    public function test_reg_number_and_business_name_must_be_unique(): void
    {
        Company::factory()->withDomains(['acme.test'])->create([
            'reg_number' => '51824753556',
            'business_name' => 'Acme Pty Ltd',
        ]);
        $this->loginAsAdmin();
        $country = Country::factory()->create();

        $this->asSpa()->postJson('/api/admin/companies', [
            'company_type' => 'broker',
            'country_id' => $country->id,
            'reg_number' => '518 247 535 56',
            'reg_type' => 'ABN',
            'business_name' => 'Fresh Co',
            'phone' => '02',
            'email' => 'a@fresh.test',
            'address' => '2 St',
            'allowed_domains' => ['fresh.test'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['reg_number']);

        $this->asSpa()->postJson('/api/admin/companies', [
            'company_type' => 'broker',
            'country_id' => $country->id,
            'reg_number' => '99999999999',
            'reg_type' => 'ABN',
            'business_name' => 'acme pty ltd',
            'phone' => '02',
            'email' => 'a@fresh.test',
            'address' => '2 St',
            'allowed_domains' => ['fresh.test'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['business_name']);
    }

    public function test_uniqueness_check_reports_per_field_conflicts(): void
    {
        $existing = Company::factory()->withDomains(['acme.test'])->create([
            'reg_number' => '51824753556',
            'business_name' => 'Acme Pty Ltd',
        ]);
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/companies/check-uniqueness', [
            'reg_number' => '51824753556',
            'business_name' => 'Acme Pty Ltd',
            'allowed_domains' => ['acme.test'],
        ])->assertOk()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('fields.reg_number.ok', false)
            ->assertJsonPath('fields.business_name.ok', false)
            ->assertJsonPath('fields.allowed_domains.ok', false);

        $this->asSpa()->postJson('/api/admin/companies/check-uniqueness', [
            'company_id' => $existing->id,
            'reg_number' => '51824753556',
            'business_name' => 'Acme Pty Ltd',
            'allowed_domains' => ['acme.test'],
        ])->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('fields.reg_number.ok', true)
            ->assertJsonPath('fields.business_name.ok', true)
            ->assertJsonPath('fields.allowed_domains.ok', true);

        $this->asSpa()->postJson('/api/admin/companies/check-uniqueness', [
            'reg_number' => '11111111111',
            'business_name' => 'Fresh Co',
            'allowed_domains' => ['fresh.test'],
        ])->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_broker_with_linked_customers_cannot_change_type_to_customer(): void
    {
        $this->loginAsAdmin();
        $broker = Company::factory()->create(['company_type' => CompanyType::Broker]);
        Company::factory()->forNetworkOf($broker, CompanyType::Customer)->create();

        $this->asSpa()->putJson('/api/admin/companies/'.$broker->id, $this->detailsPayload($broker, [
            'company_type' => 'customer',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_type'])
            ->assertJsonPath('errors.company_type.0', 'Cannot change to Customer while linked customer companies exist.');
    }

    public function test_broker_with_linked_providers_cannot_change_type_to_provider(): void
    {
        $this->loginAsAdmin();
        $broker = Company::factory()->create(['company_type' => CompanyType::Broker]);
        Company::factory()->forNetworkOf($broker, CompanyType::Provider)->create();

        $this->asSpa()->putJson('/api/admin/companies/'.$broker->id, $this->detailsPayload($broker, [
            'company_type' => 'provider',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_type'])
            ->assertJsonPath('errors.company_type.0', 'Cannot change to Provider while linked provider companies exist.');
    }

    public function test_linked_company_cannot_be_saved_as_broker(): void
    {
        $this->loginAsAdmin();
        $parent = Company::factory()->create(['company_type' => CompanyType::Broker]);
        $child = Company::factory()->forNetworkOf($parent, CompanyType::Provider)->create();

        $this->asSpa()->putJson('/api/admin/companies/'.$child->id, $this->detailsPayload($child, [
            'company_type' => 'broker',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_type'])
            ->assertJsonPath('errors.company_type.0', 'Linked companies cannot be Broker.');
    }

    public function test_show_company_exposes_blocked_root_company_types(): void
    {
        $this->loginAsAdmin();
        $broker = Company::factory()->create(['company_type' => CompanyType::Broker]);
        Company::factory()->forNetworkOf($broker, CompanyType::Customer)->create();
        Company::factory()->forNetworkOf($broker, CompanyType::Provider)->create();

        $this->asSpa()->getJson('/api/admin/companies/'.$broker->id)
            ->assertOk()
            ->assertJsonPath('company.blocked_root_company_types', ['customer', 'provider']);
    }

    public function test_linked_provider_cannot_change_type_to_customer(): void
    {
        $this->loginAsAdmin();
        $parent = Company::factory()->create([
            'company_type' => CompanyType::Broker,
            'business_name' => 'Acme Parent',
        ]);
        $child = Company::factory()->forNetworkOf($parent, CompanyType::Provider)->create();

        $this->asSpa()->putJson('/api/admin/companies/'.$child->id, $this->detailsPayload($child, [
            'company_type' => 'customer',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_type'])
            ->assertJsonPath(
                'errors.company_type.0',
                'Cannot change company type while linked as a Provider of Acme Parent.',
            );

        $this->asSpa()->getJson('/api/admin/companies/'.$child->id)
            ->assertOk()
            ->assertJsonPath('company.blocked_root_company_types', ['customer']);
    }

    public function test_linked_customer_cannot_change_type_to_provider(): void
    {
        $this->loginAsAdmin();
        $parent = Company::factory()->create(['company_type' => CompanyType::Broker]);
        $child = Company::factory()->forNetworkOf($parent, CompanyType::Customer)->create();

        $this->asSpa()->putJson('/api/admin/companies/'.$child->id, $this->detailsPayload($child, [
            'company_type' => 'provider',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_type']);

        $this->asSpa()->getJson('/api/admin/companies/'.$child->id)
            ->assertOk()
            ->assertJsonPath('company.blocked_root_company_types', ['provider']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function detailsPayload(Company $company, array $overrides = []): array
    {
        $type = $company->company_type instanceof CompanyType
            ? $company->company_type->value
            : (string) $company->company_type;

        return array_merge([
            'section' => 'details',
            'company_type' => $type,
            'country_id' => $company->country_id,
            'reg_number' => $company->reg_number,
            'reg_type' => $company->reg_type,
            'business_name' => $company->business_name,
            'phone' => $company->phone,
            'email' => $company->email,
            'address' => $company->address,
            'allowed_domains' => $company->allowed_domains ?? [],
        ], $overrides);
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

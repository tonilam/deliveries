<?php

namespace Tests\Feature\Admin;

use App\Models\Company;
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

        $this->asSpa()->getJson('/api/admin/companies')
            ->assertOk()
            ->assertJsonPath('companies', []);

        $create = $this->asSpa()->postJson('/api/admin/companies', [
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
            ->assertJsonPath('company.invoicee_name', '')
            ->assertJsonPath('company.gst_rate', 0.1)
            ->assertJsonPath('company.tracking_option', null);

        $id = $create->json('company.id');

        $this->asSpa()->putJson('/api/admin/companies/'.$id, [
            'section' => 'details',
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
            ->assertJsonCount(1, 'companies');
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

        $this->asSpa()->postJson('/api/admin/companies', [
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

        $this->asSpa()->postJson('/api/admin/companies', [
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

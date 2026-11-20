<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_persists_required_fields(): void
    {
        $company = Company::factory()->create([
            'reg_number' => '51824753556',
            'reg_type' => 'ABN',
            'business_name' => 'Truckit Metro Pty Ltd',
            'invoicee_name' => 'Accounts Payable',
            'phone' => '0299998888',
            'email' => 'billing@truckit.example',
            'address' => '100 Warehouse Way, Sydney NSW 2000',
        ]);

        $this->assertDatabaseHas('companies', [
            'id' => $company->id,
            'reg_number' => '51824753556',
            'reg_type' => 'ABN',
            'business_name' => 'Truckit Metro Pty Ltd',
            'invoicee_name' => 'Accounts Payable',
            'phone' => '0299998888',
            'email' => 'billing@truckit.example',
            'address' => '100 Warehouse Way, Sydney NSW 2000',
        ]);
    }

    public function test_user_belongs_to_company_and_company_has_users_and_addresses(): void
    {
        $company = Company::factory()->create();
        $user = User::factory()->forCompany($company)->create();
        $address = Address::factory()->for($company)->create();

        $this->assertTrue($user->company->is($company));
        $this->assertTrue($company->users->contains($user));
        $this->assertTrue($company->addresses->contains($address));
        $this->assertTrue($address->company->is($company));
    }
}

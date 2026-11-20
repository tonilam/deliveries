<?php

namespace Tests\Feature;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\Company;
use App\Models\User;
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

    public function test_admin_cannot_list_or_create_addresses(): void
    {
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/addresses')->assertForbidden();
        $this->asSpa()->postJson('/api/addresses', $this->validPayload())->assertForbidden();
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
            'zone' => 'Sydney',
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
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($customer);

        $response = $this->asSpa()->postJson('/api/addresses', [
            ...$this->validPayload(),
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
                'zone',
                'state',
                'postcode',
            ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'type' => AddressType::Collection->value,
            'business_name' => 'Acme Logistics',
            'address' => '42 Warehouse Rd',
            'zone' => 'Melbourne',
            'state' => 'VIC',
            'postcode' => '3000',
        ];
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

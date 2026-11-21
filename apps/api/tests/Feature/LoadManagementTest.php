<?php

namespace Tests\Feature;

use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Item;
use App\Models\Load;
use App\Models\User;
use Database\Seeders\GoodTypeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoadManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(GoodTypeSeeder::class);
    }

    public function test_guest_cannot_list_loads(): void
    {
        $this->asSpa()->getJson('/api/loads')->assertUnauthorized();
    }

    public function test_party_options_without_search_returns_up_to_ten(): void
    {
        [$owner, , , , , $user] = $this->brokerFixture();
        for ($i = 1; $i <= 15; $i++) {
            Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create([
                'business_name' => sprintf('Provider %02d', $i),
            ]);
        }

        $this->loginAs($user);

        $this->asSpa()->getJson('/api/loads/party-options?party_type=provider')
            ->assertOk()
            ->assertJsonCount(10, 'companies')
            ->assertJsonPath('companies.0.business_name', 'Provider 01');

        $this->asSpa()->getJson('/api/loads/party-options?party_type=provider&q=Pro')
            ->assertOk()
            ->assertJsonCount(15, 'companies');
    }

    public function test_broker_creates_direct_load_with_network_parties(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();

        $this->loginAs($user);

        $response = $this->asSpa()->postJson('/api/loads', [
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 4,
        ]);

        $response->assertCreated()
            ->assertJsonPath('load.type', 'direct')
            ->assertJsonPath('load.pallet_count', 4)
            ->assertJsonPath('load.customer_company_id', $customer->id);
    }

    public function test_assign_and_unassign_item(): void
    {
        [$owner, , , $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN']);

        $this->asSpa()->postJson("/api/loads/{$load->id}/items", ['item_id' => $item->id])
            ->assertOk()
            ->assertJsonPath('item.load_id', $load->id);

        $this->asSpa()->getJson("/api/items?load_id={$load->id}")
            ->assertOk()
            ->assertJsonCount(1, 'items');

        $this->asSpa()->deleteJson("/api/loads/{$load->id}/items/{$item->id}")
            ->assertOk();

        $this->assertNull($item->fresh()->load_id);
    }

    public function test_delete_direct_load_unassigns_items_and_deletes_children(): void
    {
        [$owner, , $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $child = Load::query()->create([
            'company_id' => $owner->id,
            'parent_load_id' => $load->id,
            'type' => LoadType::AddDrop,
            'customer_company_id' => $load->customer_company_id,
            'provider_company_id' => $load->provider_company_id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'pallet_count' => 1,
        ]);

        $parentItem = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $load->id]);
        $childItem = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $child->id]);

        $this->asSpa()->deleteJson("/api/loads/{$load->id}")->assertOk();

        $this->assertNull($parentItem->fresh()->load_id);
        $this->assertNull($childItem->fresh()->load_id);
        $this->assertDatabaseMissing('loads', ['id' => $child->id]);
    }

    public function test_provider_owner_cannot_create_x_dock_child(): void
    {
        $owner = Company::factory()->create(['company_type' => CompanyType::Provider]);
        $customer = Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create();
        $collection = Address::factory()->for($owner)->collection()->create();
        $delivery = Address::factory()->for($owner)->delivery()->create();
        $user = User::factory()->forCompany($owner)->create([
            'email' => 'provider-owner@example.com',
            'password' => 'Password1!',
        ]);

        $load = Load::query()->create([
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $owner->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ]);

        $this->loginAs($user);

        $this->asSpa()->postJson("/api/loads/{$load->id}/children", [
            'type' => 'x_dock',
            'xdock_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'delivery_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'secondary_provider_company_id' => 1,
            'pallet_count' => 1,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    /**
     * @return array{0: Company, 1: Company, 2: Company, 3: Address, 4: Address, 5: User}
     */
    private function brokerFixture(): array
    {
        $owner = Company::factory()->create(['company_type' => CompanyType::Broker]);
        $customer = Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create();
        $provider = Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create();
        $collection = Address::factory()->for($owner)->collection()->create();
        $delivery = Address::factory()->for($owner)->delivery()->create();
        $user = User::factory()->forCompany($owner)->create([
            'email' => 'broker@example.com',
            'password' => 'Password1!',
        ]);

        return [$owner, $customer, $provider, $collection, $delivery, $user];
    }

    private function createDirectLoad(Company $owner, Address $collection, Address $delivery): Load
    {
        $customer = Company::query()
            ->where('parent_company_id', $owner->id)
            ->where('company_type', CompanyType::Customer)
            ->firstOrFail();
        $provider = Company::query()
            ->where('parent_company_id', $owner->id)
            ->where('company_type', CompanyType::Provider)
            ->firstOrFail();

        return Load::query()->create([
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
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

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

    public function test_list_loads_item_count_includes_child_items(): void
    {
        [$owner, , , $collection, $delivery, $user] = $this->brokerFixture();
        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $childDelivery = Address::factory()->for($owner)->delivery()->create();
        $child = Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'parent_load_id' => $load->id,
            'type' => LoadType::AddDrop,
            'customer_company_id' => $load->customer_company_id,
            'provider_company_id' => $load->provider_company_id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $childDelivery->id,
            'pallet_count' => 1,
        ], $this->scheduleAttributes()));

        Item::factory()->for($owner)->create(['load_id' => $load->id]);
        Item::factory()->for($owner)->create(['load_id' => $child->id]);
        Item::factory()->for($owner)->create(['load_id' => $child->id]);

        $this->loginAs($user);

        $this->asSpa()->getJson('/api/loads?sort=item_count&direction=desc')
            ->assertOk()
            ->assertJsonPath('loads.0.id', $load->id)
            ->assertJsonPath('loads.0.item_count', 1)
            ->assertJsonPath('loads.0.children.0.item_count', 2);
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

    public function test_dropoff_before_pickup_returns_422(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();

        $this->loginAs($user);

        $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 1,
            'pickup_date' => '2026-12-10',
            'pickup_time' => '14:00',
            'dropoff_date' => '2026-12-10',
            'dropoff_time' => '10:00',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['dropoff_date']);
    }

    public function test_broker_creates_direct_load_with_network_parties(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();

        $this->loginAs($user);

        $response = $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 4,
        ], $this->schedulePayload()));

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
        $child = Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'parent_load_id' => $load->id,
            'type' => LoadType::AddDrop,
            'customer_company_id' => $load->customer_company_id,
            'provider_company_id' => $load->provider_company_id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'pallet_count' => 1,
        ], $this->scheduleAttributes()));

        $parentItem = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $load->id]);
        $childItem = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $child->id]);

        $this->asSpa()->deleteJson("/api/loads/{$load->id}")->assertOk();

        $this->assertNull($parentItem->fresh()->load_id);
        $this->assertNull($childItem->fresh()->load_id);
        $this->assertDatabaseMissing('loads', ['id' => $child->id]);
    }

    public function test_move_item_to_existing_add_drop_child(): void
    {
        [$owner, , , $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $childDelivery = Address::factory()->for($owner)->delivery()->create();
        $child = Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'parent_load_id' => $load->id,
            'type' => LoadType::AddDrop,
            'customer_company_id' => $load->customer_company_id,
            'provider_company_id' => $load->provider_company_id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $childDelivery->id,
            'pallet_count' => 1,
        ], $this->scheduleAttributes()));

        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $load->id]);

        $this->asSpa()->postJson("/api/loads/{$load->id}/items/{$item->id}/move", [
            'child_load_id' => $child->id,
        ])
            ->assertOk()
            ->assertJsonPath('item.load_id', $child->id)
            ->assertJsonPath('child_load.id', $child->id);

        $this->assertSame($child->id, $item->fresh()->load_id);
    }

    public function test_move_item_creates_add_drop_child_with_parent_provider(): void
    {
        [$owner, , $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $load->id]);
        $childDelivery = Address::factory()->for($owner)->delivery()->create();

        $response = $this->asSpa()->postJson("/api/loads/{$load->id}/items/{$item->id}/move", array_merge([
            'type' => 'add_drop',
            'delivery_address_id' => $childDelivery->id,
            'pallet_count' => 2,
        ], $this->schedulePayload()));

        $response
            ->assertOk()
            ->assertJsonPath('child_load.type', 'add_drop')
            ->assertJsonPath('child_load.provider_company_id', $load->provider_company_id)
            ->assertJsonPath('child_load.secondary_provider_company_id', null);

        $childId = $response->json('child_load.id');
        $this->assertSame($childId, $item->fresh()->load_id);
        $this->assertSame($provider->id, (int) Load::query()->whereKey($childId)->value('provider_company_id'));
    }

    public function test_move_item_creates_x_dock_child_with_secondary_provider(): void
    {
        [$owner, , $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $secondary = Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create();
        $this->loginAs($user);

        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $load->id]);
        $xdock = Address::factory()->for($owner)->delivery()->create();
        $childDelivery = Address::factory()->for($owner)->delivery()->create();

        $response = $this->asSpa()->postJson("/api/loads/{$load->id}/items/{$item->id}/move", array_merge([
            'type' => 'x_dock',
            'xdock_address_id' => $xdock->id,
            'delivery_address_id' => $childDelivery->id,
            'secondary_provider_company_id' => $secondary->id,
            'pallet_count' => 1,
        ], $this->schedulePayload()));

        $response
            ->assertOk()
            ->assertJsonPath('child_load.type', 'x_dock')
            ->assertJsonPath('child_load.provider_company_id', $load->provider_company_id)
            ->assertJsonPath('child_load.secondary_provider_company_id', $secondary->id);

        $this->assertSame($provider->id, $response->json('child_load.provider_company_id'));
    }

    public function test_cannot_move_item_not_on_parent_direct_load(): void
    {
        [$owner, , , $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $load = $this->createDirectLoad($owner, $collection, $delivery);
        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN']);
        $childDelivery = Address::factory()->for($owner)->delivery()->create();

        $this->asSpa()->postJson("/api/loads/{$load->id}/items/{$item->id}/move", array_merge([
            'type' => 'add_drop',
            'delivery_address_id' => $childDelivery->id,
            'pallet_count' => 1,
        ], $this->schedulePayload()))->assertForbidden();
    }

    public function test_provider_owner_cannot_move_item_to_new_x_dock_child(): void
    {
        $owner = Company::factory()->create(['company_type' => CompanyType::Provider]);
        $customer = Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create();
        $collection = Address::factory()->for($owner)->collection()->create();
        $delivery = Address::factory()->for($owner)->delivery()->create();
        $user = User::factory()->forCompany($owner)->create([
            'email' => 'provider-move@example.com',
            'password' => 'Password1!',
        ]);

        $load = Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $owner->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->scheduleAttributes()));

        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => $load->id]);

        $this->loginAs($user);

        $this->asSpa()->postJson("/api/loads/{$load->id}/items/{$item->id}/move", array_merge([
            'type' => 'x_dock',
            'xdock_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'delivery_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'secondary_provider_company_id' => 1,
            'pallet_count' => 1,
        ], $this->schedulePayload()))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
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

        $load = Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $owner->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->scheduleAttributes()));

        $this->loginAs($user);

        $this->asSpa()->postJson("/api/loads/{$load->id}/children", array_merge([
            'type' => 'x_dock',
            'xdock_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'delivery_address_id' => Address::factory()->for($owner)->delivery()->create()->id,
            'secondary_provider_company_id' => 1,
            'pallet_count' => 1,
        ], $this->schedulePayload()))
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

    /**
     * @return array<string, string>
     */
    private function schedulePayload(): array
    {
        return [
            'pickup_date' => '2026-11-22',
            'pickup_time' => '08:00',
            'dropoff_date' => '2026-11-23',
            'dropoff_time' => '17:00',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function scheduleAttributes(): array
    {
        return $this->schedulePayload();
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

        return Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->scheduleAttributes()));
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

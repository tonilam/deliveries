<?php

namespace Tests\Feature;

use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Item;
use App\Models\Load;
use App\Models\User;
use App\Services\ImpersonationService;
use App\Services\LoadActivityLogger;
use Database\Seeders\GoodTypeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

class LoadActivityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(GoodTypeSeeder::class);
    }

    public function test_create_and_update_log_activity_with_diff(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $create = $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->schedulePayload()))->assertCreated();

        $loadId = $create->json('load.id');

        $activity = $this->asSpa()->getJson("/api/loads/{$loadId}/activity")->assertOk();
        $activity->assertJsonPath('activities.0.event', 'created')
            ->assertJsonPath('activities.0.causer.id', $user->id);

        $this->asSpa()->putJson("/api/loads/{$loadId}", array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 4,
        ], $this->schedulePayload()))->assertOk();

        $afterUpdate = $this->asSpa()->getJson("/api/loads/{$loadId}/activity")->assertOk();
        $afterUpdate->assertJsonPath('activities.0.event', 'updated');
        $palletsChange = collect($afterUpdate->json('activities.0.changes'))
            ->firstWhere('field', 'pallet_count');
        $this->assertNotNull($palletsChange);
        $this->assertSame(2, $palletsChange['old']);
        $this->assertSame(4, $palletsChange['new']);
    }

    public function test_no_op_update_writes_no_activity_row(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $loadId = $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->schedulePayload()))->json('load.id');

        $beforeCount = Activity::query()->where('log_name', LoadActivityLogger::LOG_NAME)->count();

        $this->asSpa()->putJson("/api/loads/{$loadId}", array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->schedulePayload()))->assertOk();

        $afterCount = Activity::query()->where('log_name', LoadActivityLogger::LOG_NAME)->count();
        $this->assertSame($beforeCount, $afterCount);
    }

    public function test_child_activity_appears_on_parent_and_child_timelines(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $parentId = $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->schedulePayload()))->json('load.id');

        $childDelivery = Address::factory()->for($owner)->delivery()->create();
        $child = $this->asSpa()->postJson("/api/loads/{$parentId}/children", array_merge([
            'type' => 'add_drop',
            'delivery_address_id' => $childDelivery->id,
            'pallet_count' => 1,
        ], $this->schedulePayload()))->assertCreated();

        $childId = $child->json('load.id');

        $parentActivity = $this->asSpa()->getJson("/api/loads/{$parentId}/activity")->assertOk();
        $this->assertTrue(
            collect($parentActivity->json('activities'))->contains(
                fn (array $row) => ($row['event'] ?? '') === 'created' && ($row['subject']['id'] ?? null) === $childId,
            ),
        );

        $childActivity = $this->asSpa()->getJson("/api/loads/{$childId}/activity")->assertOk();
        $childActivity->assertJsonPath('activities.0.event', 'created');
    }

    public function test_item_assign_unassign_and_move_are_logged(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $this->loginAs($user);

        $loadId = $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 2,
        ], $this->schedulePayload()))->json('load.id');

        $item = Item::factory()->for($owner)->create(['good_type_code' => 'GEN', 'load_id' => null]);

        $this->asSpa()->postJson("/api/loads/{$loadId}/items", ['item_id' => $item->id])->assertOk();

        $childDelivery = Address::factory()->for($owner)->delivery()->create();
        $move = $this->asSpa()->postJson("/api/loads/{$loadId}/items/{$item->id}/move", array_merge([
            'type' => 'add_drop',
            'delivery_address_id' => $childDelivery->id,
            'pallet_count' => 1,
        ], $this->schedulePayload()))->assertOk();

        $childId = $move->json('child_load.id');

        $activity = $this->asSpa()->getJson("/api/loads/{$loadId}/activity")->assertOk();
        $events = collect($activity->json('activities'))->pluck('event')->all();
        $this->assertContains('item_assigned', $events);
        $this->assertContains('item_moved', $events);
        $this->assertContains('created', $events);

        $this->asSpa()->deleteJson("/api/loads/{$childId}/items/{$item->id}")->assertOk();
        $afterUnassign = collect($this->asSpa()->getJson("/api/loads/{$loadId}/activity")->json('activities'))
            ->pluck('event')
            ->all();
        $this->assertContains('item_unassigned', $afterUnassign);
    }

    public function test_impersonation_stores_customer_causer_and_admin_impersonator(): void
    {
        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $admin = User::factory()->admin()->create([
            'email' => 'imp-admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($admin);
        $this->asSpa()->postJson("/api/admin/users/{$user->id}/impersonate")->assertOk();

        $loadId = $this->asSpa()->postJson('/api/loads', array_merge([
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 1,
        ], $this->schedulePayload()))->assertCreated()->json('load.id');

        $activity = $this->asSpa()->getJson("/api/loads/{$loadId}/activity")->assertOk();
        $activity->assertJsonPath('activities.0.causer.id', $user->id)
            ->assertJsonPath('activities.0.impersonator.id', $admin->id);

        $this->assertTrue(session()->has(ImpersonationService::SESSION_KEY));
    }

    public function test_guest_cannot_list_load_activity(): void
    {
        $load = $this->foreignLoad();

        $this->asSpa()->getJson("/api/loads/{$load->id}/activity")->assertUnauthorized();
    }

    public function test_admin_cannot_list_load_activity(): void
    {
        $load = $this->foreignLoad();
        $admin = User::factory()->admin()->create([
            'email' => 'admin-activity@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($admin);
        $this->asSpa()->getJson("/api/loads/{$load->id}/activity")->assertForbidden();
    }

    public function test_other_company_cannot_list_load_activity(): void
    {
        $load = $this->foreignLoad();
        $otherOwner = Company::factory()->create(['company_type' => CompanyType::Broker]);
        $otherUser = User::factory()->forCompany($otherOwner)->create([
            'email' => 'other-broker@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($otherUser);
        $this->asSpa()->getJson("/api/loads/{$load->id}/activity")->assertNotFound();
    }

    private function foreignLoad(): Load
    {
        [$owner, $customer, $provider, $collection, $delivery] = $this->brokerFixture();

        return Load::query()->create(array_merge([
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 1,
        ], $this->scheduleAttributes()));
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
            'email' => 'broker-activity@example.com',
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

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

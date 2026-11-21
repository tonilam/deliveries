<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\GoodType;
use App\Models\Item;
use App\Models\User;
use Database\Seeders\GoodTypeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ItemManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(GoodTypeSeeder::class);
    }

    public function test_guest_cannot_list_items(): void
    {
        $this->asSpa()->getJson('/api/items')->assertUnauthorized();
    }

    public function test_admin_cannot_create_item(): void
    {
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->postJson('/api/items', $this->validPayload())->assertForbidden();
    }

    public function test_customer_creates_and_lists_company_item(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($customer);

        $create = $this->asSpa()->postJson('/api/items', $this->validPayload([
            'weight_tonnes' => 1.5,
            'display_unit' => 'tonnes',
            'order_number' => 'ORD-1',
        ]));
        $create->assertCreated()
            ->assertJsonPath('item.good_type_code', 'GEN')
            ->assertJsonPath('item.weight_tonnes', '1.500000')
            ->assertJsonPath('item.display_unit', 'tonnes')
            ->assertJsonPath('item.order_number', 'ORD-1');

        $this->asSpa()->getJson('/api/items')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.good_type', 'General');
    }

    public function test_customer_cannot_access_other_company_item(): void
    {
        $mine = Company::factory()->create();
        $other = Company::factory()->create();
        $customer = User::factory()->forCompany($mine)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $item = Item::factory()->for($other)->create([
            'good_type_code' => 'GEN',
        ]);

        $this->loginAs($customer);

        $this->asSpa()->getJson("/api/items/{$item->id}")->assertNotFound();
        $this->asSpa()->putJson("/api/items/{$item->id}", $this->validPayload())->assertNotFound();
        $this->asSpa()->deleteJson("/api/items/{$item->id}")->assertNotFound();
    }

    public function test_rejects_non_positive_weight(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/items', $this->validPayload(['weight_tonnes' => 0]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['weight_tonnes']);
    }

    public function test_rejects_soft_deleted_good_type(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $type = GoodType::query()->where('code', 'GEN')->firstOrFail();
        $type->delete();

        $this->loginAs($customer);

        $this->asSpa()->postJson('/api/items', $this->validPayload(['good_type_code' => 'GEN']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['good_type_code']);
    }

    public function test_customer_can_update_item_without_changing_soft_deleted_good_type(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $type = GoodType::query()->where('code', 'GEN')->firstOrFail();
        $item = Item::factory()->for($company)->create([
            'good_type_code' => 'GEN',
            'weight_tonnes' => 2,
            'display_unit' => 'tonnes',
        ]);
        $type->delete();

        $this->loginAs($customer);

        $this->asSpa()->putJson("/api/items/{$item->id}", [
            'good_type_code' => 'GEN',
            'weight_tonnes' => 2.5,
            'display_unit' => 'tonnes',
            'order_number' => null,
            'connote' => null,
        ])
            ->assertOk()
            ->assertJsonPath('item.weight_tonnes', '2.500000');
    }

    public function test_good_type_options_for_customer(): void
    {
        $company = Company::factory()->create();
        $customer = User::factory()->forCompany($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($customer);

        $this->asSpa()->getJson('/api/items/good-type-options')
            ->assertOk()
            ->assertJsonStructure(['good_types' => [['code', 'name']]]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'good_type_code' => 'GEN',
            'weight_tonnes' => 0.5,
            'display_unit' => 'kg',
            'order_number' => null,
            'connote' => null,
        ], $overrides);
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

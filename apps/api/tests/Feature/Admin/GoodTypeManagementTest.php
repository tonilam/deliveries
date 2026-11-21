<?php

namespace Tests\Feature\Admin;

use App\Models\GoodType;
use App\Models\User;
use Database\Seeders\GoodTypeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GoodTypeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_good_types(): void
    {
        $this->asSpa()->getJson('/api/admin/good-types')->assertUnauthorized();
    }

    public function test_customer_cannot_list_good_types(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/admin/good-types')->assertForbidden();
    }

    public function test_admin_can_crud_good_types(): void
    {
        $this->loginAsAdmin();

        $create = $this->asSpa()->postJson('/api/admin/good-types', [
            'code' => 'tst',
            'name' => 'Test goods',
            'refrigerated_required' => true,
        ]);

        $create->assertCreated()
            ->assertJsonPath('good_type.code', 'TST')
            ->assertJsonPath('good_type.name', 'Test goods')
            ->assertJsonPath('good_type.refrigerated_required', true);

        $this->asSpa()->getJson('/api/admin/good-types')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('good_types.0.code', 'TST');

        $this->asSpa()->getJson('/api/admin/good-types/TST')
            ->assertOk()
            ->assertJsonPath('good_type.name', 'Test goods');

        $this->asSpa()->putJson('/api/admin/good-types/TST', [
            'name' => 'Test goods updated',
            'refrigerated_required' => false,
        ])->assertOk()
            ->assertJsonPath('good_type.name', 'Test goods updated')
            ->assertJsonPath('good_type.refrigerated_required', false);

        $this->asSpa()->deleteJson('/api/admin/good-types/TST')
            ->assertNoContent();

        $this->asSpa()->getJson('/api/admin/good-types')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $this->asSpa()->getJson('/api/admin/good-types/TST')
            ->assertNotFound();

        $this->assertSoftDeleted('good_types', ['code' => 'TST']);
    }

    public function test_good_type_code_must_be_unique(): void
    {
        $this->loginAsAdmin();
        GoodType::factory()->create(['code' => 'FRZ', 'name' => 'Frozen']);

        $this->asSpa()->postJson('/api/admin/good-types', [
            'code' => 'FRZ',
            'name' => 'Other',
            'refrigerated_required' => true,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_soft_deleted_code_cannot_be_recreated(): void
    {
        $this->loginAsAdmin();
        GoodType::factory()->create(['code' => 'OLD', 'name' => 'Old type']);
        GoodType::query()->where('code', 'OLD')->firstOrFail()->delete();

        $this->asSpa()->postJson('/api/admin/good-types', [
            'code' => 'OLD',
            'name' => 'New old',
            'refrigerated_required' => false,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_list_filters_refrigerated_required_by_set_filter_yes_no(): void
    {
        $this->loginAsAdmin();
        GoodType::factory()->create(['code' => 'FRZ', 'name' => 'Frozen', 'refrigerated_required' => true]);
        GoodType::factory()->create(['code' => 'DRY', 'name' => 'Dry', 'refrigerated_required' => false]);

        $this->asSpa()
            ->getJson('/api/admin/good-types?'.http_build_query([
                'filter' => [
                    'refrigerated_required' => ['type' => 'equals', 'filter' => 'Yes'],
                ],
            ]))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('good_types.0.code', 'FRZ');

        $this->asSpa()
            ->getJson('/api/admin/good-types?'.http_build_query([
                'filter' => [
                    'refrigerated_required' => ['type' => 'equals', 'filter' => 'No'],
                ],
            ]))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('good_types.0.code', 'DRY');

        $this->asSpa()
            ->getJson('/api/admin/good-types?'.http_build_query([
                'filter' => [
                    'refrigerated_required' => ['type' => 'equals', 'filter' => '__no_match__'],
                ],
            ]))
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_good_type_seeder_is_idempotent_and_restores(): void
    {
        $this->seed(GoodTypeSeeder::class);
        $this->assertDatabaseCount('good_types', 5);

        GoodType::query()->where('code', 'FRZ')->firstOrFail()->delete();
        $this->assertSoftDeleted('good_types', ['code' => 'FRZ']);

        $this->seed(GoodTypeSeeder::class);
        $this->assertDatabaseCount('good_types', 5);
        $this->assertDatabaseHas('good_types', [
            'code' => 'FRZ',
            'name' => 'Frozen',
            'deleted_at' => null,
        ]);
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

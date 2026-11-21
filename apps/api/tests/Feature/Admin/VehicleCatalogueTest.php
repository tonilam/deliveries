<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Database\Seeders\AustraliaVehicleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleCatalogueTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_vehicle_categories(): void
    {
        $this->asSpa()->getJson('/api/admin/vehicle-categories')->assertUnauthorized();
    }

    public function test_customer_cannot_list_vehicle_categories(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/admin/vehicle-categories')->assertForbidden();
    }

    public function test_admin_can_crud_categories_and_soft_delete_when_empty(): void
    {
        $this->loginAsAdmin();

        $create = $this->asSpa()->postJson('/api/admin/vehicle-categories', [
            'name' => 'Rigid',
            'code' => 'rigid',
            'sort_order' => 20,
        ]);

        $create->assertCreated()
            ->assertJsonPath('vehicle_category.code', 'rigid');

        $id = $create->json('vehicle_category.id');

        $this->asSpa()->putJson('/api/admin/vehicle-categories/'.$id, [
            'name' => 'Rigid truck',
            'code' => 'rigid',
            'sort_order' => 25,
        ])->assertOk()
            ->assertJsonPath('vehicle_category.name', 'Rigid truck');

        $this->asSpa()->deleteJson('/api/admin/vehicle-categories/'.$id)
            ->assertNoContent();

        $this->asSpa()->getJson('/api/admin/vehicle-categories')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_cannot_delete_category_with_body_types(): void
    {
        $category = VehicleCategory::factory()->create();
        VehicleBodyType::factory()->create(['vehicle_category_id' => $category->id]);
        $this->loginAsAdmin();

        $this->asSpa()->deleteJson('/api/admin/vehicle-categories/'.$category->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['vehicle_category']);
    }

    public function test_admin_can_manage_body_type_options_and_values(): void
    {
        $category = VehicleCategory::factory()->create();
        $this->loginAsAdmin();

        $createBody = $this->asSpa()->postJson(
            '/api/admin/vehicle-categories/'.$category->id.'/body-types',
            [
                'name' => 'Tautliner',
                'code' => 'tautliner',
                'capacity' => 22,
                'capacity_unit' => 'pallet',
                'pallet_spaces' => 22,
                'payload_kg' => 22000,
            ],
        );

        $createBody->assertCreated();
        $bodyTypeId = $createBody->json('vehicle_body_type.id');

        $this->asSpa()->postJson(
            '/api/admin/vehicle-categories/'.$category->id.'/body-types/'.$bodyTypeId.'/options',
            [
                'key' => 'mezzanine',
                'label' => 'Mezzanine',
                'data_type' => 'boolean',
                'visibility' => 'public',
                'required' => true,
            ],
        )->assertCreated();

        $this->asSpa()->putJson(
            '/api/admin/vehicle-categories/'.$category->id.'/body-types/'.$bodyTypeId,
            [
                'name' => 'Tautliner',
                'code' => 'tautliner',
                'capacity' => 22,
                'capacity_unit' => 'pallet',
                'pallet_spaces' => 22,
                'payload_kg' => 22000,
                'option_values' => ['mezzanine' => true],
            ],
        )->assertOk()
            ->assertJsonPath('vehicle_body_type.option_values.mezzanine', true);
    }

    public function test_admin_catalogue_lists_all_categories_with_body_types(): void
    {
        $this->loginAsAdmin();
        $this->seed(AustraliaVehicleSeeder::class);

        $response = $this->asSpa()->getJson('/api/admin/vehicle-categories?catalogue=1');

        $response->assertOk()->assertJsonMissingPath('meta');
        $this->assertNotEmpty($response->json('vehicle_categories'));
        $this->assertNotEmpty($response->json('vehicle_categories.0.body_types'));
    }

    public function test_australia_vehicle_seeder_is_idempotent(): void
    {
        $this->seed(AustraliaVehicleSeeder::class);
        $this->seed(AustraliaVehicleSeeder::class);

        $this->assertSame(6, VehicleCategory::query()->count());
        $this->assertGreaterThan(10, VehicleBodyType::query()->count());

        $semi = VehicleCategory::query()->where('code', 'semi_trailer')->firstOrFail();
        $tautliner = VehicleBodyType::query()
            ->where('vehicle_category_id', $semi->id)
            ->where('code', 'tautliner')
            ->firstOrFail();

        $this->assertSame(['mezzanine' => false], $tautliner->option_values);
        $this->assertTrue($tautliner->options()->where('key', 'mezzanine')->exists());
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

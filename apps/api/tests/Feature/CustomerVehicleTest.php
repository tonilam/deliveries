<?php

namespace Tests\Feature;

use App\Enums\VehicleBodyTypeOptionDataType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Models\Company;
use App\Models\User;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerVehicleTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_vehicle_routes(): void
    {
        $bodyType = VehicleBodyType::factory()->create();

        $this->asSpa()->getJson('/api/vehicles')->assertUnauthorized();
        $this->asSpa()->getJson('/api/vehicles/body-type-options')->assertUnauthorized();
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])
            ->assertUnauthorized();
    }

    public function test_admin_cannot_access_vehicle_routes(): void
    {
        $bodyType = VehicleBodyType::factory()->create();
        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->getJson('/api/vehicles')->assertForbidden();
        $this->asSpa()->getJson('/api/vehicles/body-type-options')->assertForbidden();
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])
            ->assertForbidden();
    }

    public function test_customer_without_company_cannot_access_vehicle_routes(): void
    {
        $bodyType = VehicleBodyType::factory()->create();
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
            'company_id' => null,
        ]));

        $this->asSpa()->getJson('/api/vehicles')->assertForbidden();
        $this->asSpa()->getJson('/api/vehicles/body-type-options')->assertForbidden();
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])
            ->assertForbidden();
    }

    public function test_catalogue_lists_inactive_body_types_and_omits_soft_deleted(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $category = VehicleCategory::factory()->create();
        $live = VehicleBodyType::factory()->create([
            'vehicle_category_id' => $category->id,
            'name' => 'Live type',
            'code' => 'live_type',
        ]);
        $deleted = VehicleBodyType::factory()->create([
            'vehicle_category_id' => $category->id,
            'name' => 'Deleted type',
            'code' => 'deleted_type',
        ]);
        $deleted->delete();

        $response = $this->asSpa()->getJson('/api/vehicles');
        $response->assertOk();
        $categories = collect($response->json('vehicle_categories'));
        $this->assertNotEmpty($categories);
        $bodyTypes = collect($categories->firstWhere('id', $category->id)['body_types'] ?? []);
        $this->assertTrue($bodyTypes->contains(fn (array $row) => $row['id'] === $live->id && $row['active'] === false));
        $this->assertFalse($bodyTypes->contains('id', $deleted->id));
        $this->assertArrayNotHasKey('option_values', $bodyTypes->first());
    }

    public function test_soft_deleted_category_is_omitted(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $category = VehicleCategory::factory()->create();
        VehicleBodyType::factory()->create(['vehicle_category_id' => $category->id]);
        $category->delete();

        $response = $this->asSpa()->getJson('/api/vehicles');
        $response->assertOk();
        $this->assertFalse(
            collect($response->json('vehicle_categories'))->contains('id', $category->id),
        );
    }

    public function test_activation_is_scoped_per_company(): void
    {
        $companyA = Company::factory()->create();
        $companyB = Company::factory()->create();
        $this->loginAs(User::factory()->for($companyA)->create([
            'email' => 'customer-a@example.com',
            'password' => 'Password1!',
        ]));

        $category = VehicleCategory::factory()->create();
        $bodyType = VehicleBodyType::factory()->create([
            'vehicle_category_id' => $category->id,
            'code' => 'scoped_type',
        ]);

        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])->assertOk();

        $this->assertDatabaseHas('company_vehicle_body_types', [
            'company_id' => $companyA->id,
            'vehicle_body_type_id' => $bodyType->id,
        ]);
        $this->assertDatabaseMissing('company_vehicle_body_types', [
            'company_id' => $companyB->id,
            'vehicle_body_type_id' => $bodyType->id,
        ]);
    }

    public function test_company_can_toggle_activation_and_options_reflect_active_only(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $category = VehicleCategory::factory()->create();
        $activeType = VehicleBodyType::factory()->create([
            'vehicle_category_id' => $category->id,
            'name' => 'A',
            'code' => 'type_a',
        ]);
        $inactiveType = VehicleBodyType::factory()->create([
            'vehicle_category_id' => $category->id,
            'name' => 'B',
            'code' => 'type_b',
        ]);

        $this->asSpa()->putJson("/api/vehicles/body-types/{$activeType->id}", ['active' => true])
            ->assertOk()
            ->assertJsonPath('vehicle_body_type.active', true);

        $options = $this->asSpa()->getJson('/api/vehicles/body-type-options');
        $options->assertOk();
        $ids = collect($options->json('vehicle_body_types'))->pluck('id')->all();
        $this->assertSame([$activeType->id], $ids);

        $this->asSpa()->putJson("/api/vehicles/body-types/{$activeType->id}", ['active' => false])
            ->assertOk();
        $this->asSpa()->getJson('/api/vehicles/body-type-options')
            ->assertOk()
            ->assertJsonPath('vehicle_body_types', []);

        $this->asSpa()->putJson("/api/vehicles/body-types/{$inactiveType->id}", ['active' => true])
            ->assertOk();
        $this->assertDatabaseCount('company_vehicle_body_types', 1);
    }

    public function test_body_type_options_include_public_definitions_only(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $bodyType = VehicleBodyType::factory()->create();
        VehicleBodyTypeOption::factory()->create([
            'vehicle_body_type_id' => $bodyType->id,
            'key' => 'deck',
            'visibility' => VehicleBodyTypeOptionVisibility::Public,
            'data_type' => VehicleBodyTypeOptionDataType::Varchar,
        ]);
        VehicleBodyTypeOption::factory()->create([
            'vehicle_body_type_id' => $bodyType->id,
            'key' => 'hidden',
            'visibility' => VehicleBodyTypeOptionVisibility::System,
        ]);

        $company->vehicleBodyTypes()->attach($bodyType->id);

        $this->asSpa()->getJson('/api/vehicles/body-type-options')
            ->assertOk()
            ->assertJsonPath('vehicle_body_types.0.options.0.key', 'deck')
            ->assertJsonMissingPath('vehicle_body_types.0.option_values');

        $catalogue = $this->asSpa()->getJson('/api/vehicles');
        $catalogue->assertOk();
        $this->assertArrayNotHasKey('options', $catalogue->json('vehicle_categories.0.body_types.0') ?? []);
    }

    public function test_cannot_activate_soft_deleted_body_type(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $bodyType = VehicleBodyType::factory()->create();
        $bodyType->delete();

        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])
            ->assertNotFound();
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

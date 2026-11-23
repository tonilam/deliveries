<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use App\Services\CompanyVehicleActivityLogger;
use App\Services\ImpersonationService;
use App\Services\LoadActivityLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

class CompanyVehicleActivityTest extends TestCase
{
    use RefreshDatabase;

    public function test_activate_and_deactivate_are_logged_newest_first(): void
    {
        $company = Company::factory()->create();
        $user = User::factory()->for($company)->create([
            'email' => 'vehicles-activity@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($user);

        $category = VehicleCategory::factory()->create(['name' => 'Curtainsider']);
        $bodyType = VehicleBodyType::factory()->create([
            'vehicle_category_id' => $category->id,
            'name' => 'Tautliner',
            'code' => 'tautliner',
        ]);

        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])->assertOk();
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => false])->assertOk();

        $activity = $this->asSpa()->getJson('/api/vehicles/activity')->assertOk();
        $activity->assertJsonPath('activities.0.event', 'deactivated')
            ->assertJsonPath('activities.0.description', 'Body type deactivated')
            ->assertJsonPath('activities.0.causer.id', $user->id)
            ->assertJsonPath('activities.0.body_type.id', $bodyType->id)
            ->assertJsonPath('activities.0.body_type.name', 'Tautliner')
            ->assertJsonPath('activities.0.body_type.code', 'tautliner')
            ->assertJsonPath('activities.0.body_type.category_name', 'Curtainsider')
            ->assertJsonPath('activities.0.changes.0.field', 'active')
            ->assertJsonPath('activities.0.changes.0.label', 'Active')
            ->assertJsonPath('activities.0.changes.0.old', true)
            ->assertJsonPath('activities.0.changes.0.new', false)
            ->assertJsonPath('activities.1.event', 'activated')
            ->assertJsonPath('activities.1.causer.id', $user->id)
            ->assertJsonPath('activities.1.changes.0.old', false)
            ->assertJsonPath('activities.1.changes.0.new', true);

        $this->assertNotNull($activity->json('activities.0.created_at'));
        $this->assertSame(
            2,
            Activity::query()->where('log_name', CompanyVehicleActivityLogger::LOG_NAME)->count(),
        );
        $this->assertSame(
            0,
            Activity::query()->where('log_name', LoadActivityLogger::LOG_NAME)->count(),
        );
    }

    public function test_repeating_the_same_active_state_writes_nothing(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'vehicles-noop@example.com',
            'password' => 'Password1!',
        ]));

        $bodyType = VehicleBodyType::factory()->create(['code' => 'noop_type']);

        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => false])->assertOk();
        $this->assertSame(0, $this->vehicleActivityCount());

        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])->assertOk();
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])->assertOk();
        $this->assertSame(1, $this->vehicleActivityCount());
    }

    public function test_soft_deleted_body_type_writes_nothing(): void
    {
        $company = Company::factory()->create();
        $this->loginAs(User::factory()->for($company)->create([
            'email' => 'vehicles-deleted@example.com',
            'password' => 'Password1!',
        ]));

        $bodyType = VehicleBodyType::factory()->create(['code' => 'deleted_type']);
        $bodyType->delete();

        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])
            ->assertNotFound();
        $this->assertSame(0, $this->vehicleActivityCount());
    }

    public function test_guest_admin_and_customer_without_company_cannot_list_activity(): void
    {
        $this->asSpa()->getJson('/api/vehicles/activity')->assertUnauthorized();

        $this->loginAs(User::factory()->admin()->create([
            'email' => 'admin-vehicles-activity@example.com',
            'password' => 'Password1!',
        ]));
        $this->asSpa()->getJson('/api/vehicles/activity')->assertForbidden();

        $this->asSpa()->postJson('/api/logout')->assertOk();

        $this->loginAs(User::factory()->create([
            'email' => 'nocompany-vehicles@example.com',
            'password' => 'Password1!',
            'company_id' => null,
        ]));
        $this->asSpa()->getJson('/api/vehicles/activity')->assertForbidden();
    }

    public function test_activity_is_limited_to_the_callers_company(): void
    {
        $companyA = Company::factory()->create();
        $companyB = Company::factory()->create();
        $userA = User::factory()->for($companyA)->create([
            'email' => 'company-a-vehicles@example.com',
            'password' => 'Password1!',
        ]);
        $userB = User::factory()->for($companyB)->create([
            'email' => 'company-b-vehicles@example.com',
            'password' => 'Password1!',
        ]);
        $bodyType = VehicleBodyType::factory()->create(['code' => 'scoped_activity']);

        $this->loginAs($userA);
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])->assertOk();
        $this->asSpa()->postJson('/api/logout')->assertOk();

        $this->loginAs($userB);
        $this->asSpa()->getJson('/api/vehicles/activity')
            ->assertOk()
            ->assertJsonPath('activities', [])
            ->assertJsonPath('meta.total', 0);

        $this->asSpa()->postJson('/api/logout')->assertOk();
        $this->loginAs($userA);
        $this->asSpa()->getJson('/api/vehicles/activity')
            ->assertOk()
            ->assertJsonPath('activities.0.body_type.id', $bodyType->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_impersonation_stores_customer_causer_and_admin_impersonator(): void
    {
        $company = Company::factory()->create();
        $user = User::factory()->for($company)->create([
            'email' => 'imp-customer-vehicles@example.com',
            'password' => 'Password1!',
        ]);
        $admin = User::factory()->admin()->create([
            'email' => 'imp-admin-vehicles@example.com',
            'password' => 'Password1!',
        ]);
        $bodyType = VehicleBodyType::factory()->create(['code' => 'impersonated_type']);

        $this->loginAs($admin);
        $this->asSpa()->postJson("/api/admin/users/{$user->id}/impersonate")->assertOk();
        $this->asSpa()->putJson("/api/vehicles/body-types/{$bodyType->id}", ['active' => true])->assertOk();

        $this->asSpa()->getJson('/api/vehicles/activity')
            ->assertOk()
            ->assertJsonPath('activities.0.causer.id', $user->id)
            ->assertJsonPath('activities.0.impersonator.id', $admin->id);

        $this->assertTrue(session()->has(ImpersonationService::SESSION_KEY));
    }

    private function vehicleActivityCount(): int
    {
        return Activity::query()->where('log_name', CompanyVehicleActivityLogger::LOG_NAME)->count();
    }

    private function loginAs(User $user): void
    {
        // A prior auth:sanctum request leaves the default guard as sanctum, which has no attempt().
        Auth::shouldUse('web');

        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

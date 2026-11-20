<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\ImpersonationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImpersonateUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_impersonate(): void
    {
        $customer = User::factory()->create();

        $this->asSpa()
            ->postJson("/api/admin/users/{$customer->id}/impersonate")
            ->assertUnauthorized();
    }

    public function test_customer_cannot_impersonate(): void
    {
        $actor = User::factory()->create([
            'email' => 'actor@example.com',
            'password' => 'Password1!',
        ]);
        $target = User::factory()->create();

        $this->loginAs($actor);

        $this->asSpa()
            ->postJson("/api/admin/users/{$target->id}/impersonate")
            ->assertForbidden();
    }

    public function test_admin_can_impersonate_active_customer(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $customer = User::factory()->create([
            'name' => 'Casey Customer',
            'email' => 'casey@example.com',
        ]);

        $this->loginAs($admin);

        $this->asSpa()
            ->postJson("/api/admin/users/{$customer->id}/impersonate")
            ->assertOk()
            ->assertJsonPath('user.id', $customer->id)
            ->assertJsonPath('user.role', UserRole::Customer->value)
            ->assertJsonPath('impersonating', true)
            ->assertJsonPath('impersonator.id', $admin->id);

        $this->asSpa()
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $customer->id)
            ->assertJsonPath('impersonating', true)
            ->assertJsonPath('impersonator.id', $admin->id);

        $this->assertTrue(session()->has(ImpersonationService::SESSION_KEY));
        $this->assertSame($admin->id, session(ImpersonationService::SESSION_KEY));
    }

    public function test_admin_cannot_impersonate_admin(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $otherAdmin = User::factory()->admin()->create([
            'email' => 'other@example.com',
        ]);

        $this->loginAs($admin);

        $this->asSpa()
            ->postJson("/api/admin/users/{$otherAdmin->id}/impersonate")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);

        $this->asSpa()
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $admin->id)
            ->assertJsonPath('impersonating', false);
    }

    public function test_admin_cannot_impersonate_inactive_customer(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $customer = User::factory()->inactive()->create();

        $this->loginAs($admin);

        $this->asSpa()
            ->postJson("/api/admin/users/{$customer->id}/impersonate")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);
    }

    public function test_cannot_start_nested_impersonation(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $first = User::factory()->create(['email' => 'first@example.com']);
        $second = User::factory()->create(['email' => 'second@example.com']);

        $this->loginAs($admin);

        $this->asSpa()->postJson("/api/admin/users/{$first->id}/impersonate")->assertOk();

        $this->asSpa()
            ->postJson("/api/admin/users/{$second->id}/impersonate")
            ->assertForbidden();
    }

    public function test_leave_impersonation_restores_admin(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $customer = User::factory()->create([
            'email' => 'casey@example.com',
        ]);

        $this->loginAs($admin);
        $this->asSpa()->postJson("/api/admin/users/{$customer->id}/impersonate")->assertOk();

        $this->asSpa()
            ->postJson('/api/impersonation/leave')
            ->assertOk()
            ->assertJsonPath('user.id', $admin->id)
            ->assertJsonPath('impersonating', false)
            ->assertJsonPath('impersonator', null);

        $this->asSpa()
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $admin->id)
            ->assertJsonPath('impersonating', false);

        $this->assertFalse(session()->has(ImpersonationService::SESSION_KEY));
    }

    public function test_leave_without_impersonation_fails(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginAs($admin);

        $this->asSpa()
            ->postJson('/api/impersonation/leave')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);
    }

    public function test_sso_only_customer_can_be_impersonated(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $customer = User::factory()->withoutPassword()->create([
            'email' => 'sso@example.com',
        ]);

        $this->loginAs($admin);

        $this->asSpa()
            ->postJson("/api/admin/users/{$customer->id}/impersonate")
            ->assertOk()
            ->assertJsonPath('user.id', $customer->id)
            ->assertJsonPath('impersonating', true);
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}

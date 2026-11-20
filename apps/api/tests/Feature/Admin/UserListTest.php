<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserListTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_users(): void
    {
        $this->asSpa()->getJson('/api/admin/users?role=admin')->assertUnauthorized();
    }

    public function test_customer_cannot_list_users(): void
    {
        User::factory()->create([
            'email' => 'c@example.com',
            'password' => 'Password1!',
            'role' => UserRole::Customer,
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users?role=customer')->assertForbidden();
    }

    public function test_admin_can_list_admin_users(): void
    {
        $admin = User::factory()->admin()->create([
            'name' => 'Ada Admin',
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);
        User::factory()->admin()->inactive()->create([
            'name' => 'Inactive Admin',
            'email' => 'inactive-admin@example.com',
        ]);
        User::factory()->create([
            'name' => 'Customer One',
            'email' => 'customer@example.com',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users?role=admin')
            ->assertOk()
            ->assertJsonCount(2, 'users')
            ->assertJsonFragment([
                'id' => $admin->id,
                'name' => 'Ada Admin',
                'email' => 'ada@example.com',
                'is_active' => true,
            ])
            ->assertJsonFragment([
                'name' => 'Inactive Admin',
                'email' => 'inactive-admin@example.com',
                'is_active' => false,
            ])
            ->assertJsonMissing(['email' => 'customer@example.com']);
    }

    public function test_admin_can_list_customer_users(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $customer = User::factory()->create([
            'name' => 'Casey Customer',
            'email' => 'casey@example.com',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users?role=customer')
            ->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.id', $customer->id)
            ->assertJsonPath('users.0.name', 'Casey Customer')
            ->assertJsonPath('users.0.email', 'casey@example.com')
            ->assertJsonPath('users.0.is_active', true);
    }

    public function test_role_query_is_required_and_validated(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users')->assertUnprocessable();
        $this->asSpa()->getJson('/api/admin/users?role=superuser')->assertUnprocessable();
    }
}

<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeatureToggleTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_read_public_feature_flags(): void
    {
        $this->asSpa()->getJson('/api/features')
            ->assertOk()
            ->assertJsonPath('features.user_registration', true);
    }

    public function test_guest_cannot_list_or_update_admin_features(): void
    {
        $this->asSpa()->getJson('/api/admin/features')->assertUnauthorized();
        $this->asSpa()->patchJson('/api/admin/features/user_registration', [
            'enabled' => false,
        ])->assertUnauthorized();
    }

    public function test_customer_cannot_list_or_update_admin_features(): void
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

        $this->asSpa()->getJson('/api/admin/features')->assertForbidden();
        $this->asSpa()->patchJson('/api/admin/features/user_registration', [
            'enabled' => false,
        ])->assertForbidden();
    }

    public function test_admin_can_list_and_toggle_features(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/features')
            ->assertOk()
            ->assertJsonFragment([
                'key' => 'user_registration',
                'name' => 'User registration',
                'enabled' => true,
            ]);

        $this->asSpa()->patchJson('/api/admin/features/user_registration', [
            'enabled' => false,
        ])
            ->assertOk()
            ->assertJsonPath('feature.enabled', false);

        $this->assertDatabaseHas('features', [
            'key' => 'user_registration',
            'enabled' => false,
        ]);

        $this->asSpa()->getJson('/api/features')
            ->assertOk()
            ->assertJsonPath('features.user_registration', false);
    }

    public function test_unknown_feature_key_returns_not_found(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->patchJson('/api/admin/features/not_a_feature', [
            'enabled' => true,
        ])->assertNotFound();
    }

    public function test_register_is_forbidden_when_user_registration_is_disabled(): void
    {
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);

        $this->asSpa()->postJson('/api/register', [
            'name' => 'New User',
            'email' => 'new@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'User registration is currently disabled.');

        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
    }
}

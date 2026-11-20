<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\Provider as SocialiteProvider;
use Laravel\Socialite\Contracts\User as SocialiteUserContract;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class RoleAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_sets_customer_role(): void
    {
        $this->asSpa()->postJson('/api/register', [
            'name' => 'Customer',
            'email' => 'c@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertCreated()
            ->assertJsonPath('user.role', 'customer');
    }

    public function test_user_payload_includes_role(): void
    {
        $user = User::factory()->create(['email' => 'c@example.com', 'password' => 'Password1!']);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.role', $user->role->value);
    }

    public function test_customer_cannot_access_admin_api(): void
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

        $this->asSpa()->getJson('/api/admin/ping')->assertForbidden();
    }

    public function test_admin_can_access_admin_api(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/ping')->assertOk()->assertJsonPath('ok', true);
    }

    public function test_inactive_user_cannot_login(): void
    {
        User::factory()->inactive()->create([
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ])->assertUnprocessable();

        $this->assertGuest();
    }

    public function test_inactive_user_cannot_use_existing_session(): void
    {
        $user = User::factory()->create([
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $user->forceFill(['is_active' => false])->save();

        $this->asSpa()->getJson('/api/user')->assertUnauthorized();
    }

    public function test_sso_logs_in_preprovisioned_admin(): void
    {
        $admin = User::factory()->admin()->withoutPassword()->create([
            'email' => 'admin@company.com',
        ]);

        $this->mockSocialiteUser(
            id: 'google-admin',
            name: 'Admin',
            email: 'admin@company.com',
        );

        $response = $this->asSpa()->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url').'/auth/callback');
        $this->assertAuthenticatedAs($admin);
        $this->assertDatabaseHas('users', [
            'email' => 'admin@company.com',
            'role' => 'admin',
        ]);
    }

    public function test_sso_does_not_create_admin_users(): void
    {
        $this->mockSocialiteUser(
            id: 'google-new-admin',
            name: 'New Admin',
            email: 'newadmin@company.com',
        );

        $this->asSpa()->get('/api/auth/google/callback')
            ->assertRedirect(config('app.frontend_url').'/auth/callback');

        $this->assertDatabaseHas('users', [
            'email' => 'newadmin@company.com',
            'role' => 'customer',
        ]);
    }

    private function mockSocialiteUser(string $id, string $name, ?string $email): void
    {
        $socialUser = Mockery::mock(SocialiteUserContract::class);
        $socialUser->shouldReceive('getId')->andReturn($id);
        $socialUser->shouldReceive('getName')->andReturn($name);
        $socialUser->shouldReceive('getEmail')->andReturn($email);
        $socialUser->shouldReceive('getNickname')->andReturn(null);
        $socialUser->shouldReceive('getAvatar')->andReturn(null);
        $socialUser->shouldReceive('getRaw')->andReturn([
            'email_verified' => true,
        ]);

        $provider = Mockery::mock(SocialiteProvider::class);
        $provider->shouldReceive('user')->andReturn($socialUser);
        $provider->shouldReceive('redirect')->andReturn(redirect('https://example.test/oauth'));

        Socialite::shouldReceive('driver')
            ->with(Mockery::type('string'))
            ->andReturn($provider);
    }
}

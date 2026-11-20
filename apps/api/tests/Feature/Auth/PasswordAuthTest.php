<?php

namespace Tests\Feature\Auth;

use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PasswordAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_is_authenticated(): void
    {
        $company = Company::factory()->withDomains(['example.com'])->create();

        $response = $this->asSpa()->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'ada@example.com')
            ->assertJsonPath('user.company_id', $company->id);

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'ada@example.com',
            'name' => 'Ada Lovelace',
            'company_id' => $company->id,
        ]);
    }

    public function test_user_can_login_with_email_and_password(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $response = $this->asSpa()->postJson('/api/login', [
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id);

        $this->assertAuthenticatedAs($user);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $response = $this->asSpa()->postJson('/api/login', [
            'email' => 'ada@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->assertGuest();
    }

    public function test_authenticated_user_can_fetch_themselves(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $response = $this->asSpa()->getJson('/api/user');

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email);
    }

    public function test_unauthenticated_user_cannot_fetch_themselves(): void
    {
        $this->asSpa()->getJson('/api/user')->assertUnauthorized();
    }

    public function test_authenticated_user_can_logout(): void
    {
        User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out');

        $this->asSpa()->getJson('/api/user')->assertUnauthorized();
    }
}

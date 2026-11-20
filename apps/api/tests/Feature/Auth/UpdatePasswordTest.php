<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Contracts\Provider as SocialiteProvider;
use Laravel\Socialite\Contracts\User as SocialiteUserContract;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class UpdatePasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_user_payload_includes_has_password_true(): void
    {
        User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginWithPassword('ada@example.com', 'Password1!');

        $this->asSpa()->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.has_password', true);
    }

    public function test_sso_only_user_payload_includes_has_password_false(): void
    {
        User::factory()->withoutPassword()->create([
            'email' => 'ada@gmail.com',
        ]);

        $this->loginWithSso('ada@gmail.com', 'google-sso-1');

        $this->asSpa()->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.has_password', false);
    }

    public function test_password_user_can_update_password(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginWithPassword('ada@example.com', 'Password1!');

        $response = $this->asSpa()->putJson('/api/user/password', [
            'current_password' => 'Password1!',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Password updated')
            ->assertJsonPath('user.has_password', true);

        $this->assertTrue(Hash::check('NewPassword1!', $user->fresh()->password));
    }

    public function test_update_password_fails_with_wrong_current_password(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginWithPassword('ada@example.com', 'Password1!');

        $this->asSpa()->putJson('/api/user/password', [
            'current_password' => 'WrongPassword1!',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);

        $this->assertTrue(Hash::check('Password1!', $user->fresh()->password));
    }

    public function test_update_password_fails_with_invalid_new_password(): void
    {
        User::factory()->create([
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);

        $this->loginWithPassword('ada@example.com', 'Password1!');

        $this->asSpa()->putJson('/api/user/password', [
            'current_password' => 'Password1!',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    public function test_sso_only_user_cannot_update_password(): void
    {
        $user = User::factory()->withoutPassword()->create([
            'email' => 'ada@gmail.com',
        ]);

        $this->loginWithSso('ada@gmail.com', 'google-sso-2');

        $this->asSpa()->putJson('/api/user/password', [
            'current_password' => 'anything',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertForbidden();

        $this->assertNull($user->fresh()->getAttributes()['password']);
    }

    public function test_guest_cannot_update_password(): void
    {
        $this->asSpa()->putJson('/api/user/password', [
            'current_password' => 'Password1!',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnauthorized();
    }

    private function loginWithPassword(string $email, string $password): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $email,
            'password' => $password,
        ])->assertOk();
    }

    private function loginWithSso(string $email, string $providerId): void
    {
        $socialUser = Mockery::mock(SocialiteUserContract::class);
        $socialUser->shouldReceive('getId')->andReturn($providerId);
        $socialUser->shouldReceive('getName')->andReturn('Ada');
        $socialUser->shouldReceive('getEmail')->andReturn($email);
        $socialUser->shouldReceive('getNickname')->andReturn(null);
        $socialUser->shouldReceive('getAvatar')->andReturn(null);
        $socialUser->shouldReceive('getRaw')->andReturn([
            'email_verified' => true,
        ]);

        $provider = Mockery::mock(SocialiteProvider::class);
        $provider->shouldReceive('user')->andReturn($socialUser);

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        $this->asSpa()->get('/api/auth/google/callback')
            ->assertRedirect(config('app.frontend_url').'/auth/callback');
    }
}

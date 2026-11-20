<?php

namespace Tests\Feature\Auth;

use App\Models\Feature;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\Provider as SocialiteProvider;
use Laravel\Socialite\Contracts\User as SocialiteUserContract;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class SocialAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_provider_returns_not_found(): void
    {
        $this->asSpa()->get('/api/auth/facebook/redirect')->assertNotFound();
    }

    public function test_sso_callback_creates_user_and_social_account(): void
    {
        $this->mockSocialiteUser(
            id: 'google-123',
            name: 'Ada Lovelace',
            email: 'ada@gmail.com',
        );

        $response = $this->asSpa()->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url').'/auth/callback');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'ada@gmail.com',
            'name' => 'Ada Lovelace',
            'role' => 'customer',
        ]);
        $this->assertDatabaseHas('social_accounts', [
            'provider' => 'google',
            'provider_id' => 'google-123',
        ]);
        $this->assertNull(User::query()->where('email', 'ada@gmail.com')->value('password'));
    }

    public function test_sso_callback_links_to_existing_email_user(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@gmail.com',
            'password' => 'Password1!',
        ]);

        $this->mockSocialiteUser(
            id: 'apple-456',
            name: 'Ada',
            email: 'ada@gmail.com',
        );

        $response = $this->asSpa()->get('/api/auth/apple/callback');

        $response->assertRedirect(config('app.frontend_url').'/auth/callback');

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => $user->id,
            'provider' => 'apple',
            'provider_id' => 'apple-456',
        ]);
    }

    public function test_sso_callback_logs_in_existing_social_account(): void
    {
        $user = User::factory()->create([
            'email' => 'ada@gmail.com',
            'password' => null,
        ]);

        SocialAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'google',
            'provider_id' => 'google-123',
        ]);

        $this->mockSocialiteUser(
            id: 'google-123',
            name: 'Ada Lovelace',
            email: 'ada@gmail.com',
        );

        $response = $this->asSpa()->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url').'/auth/callback');

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('social_accounts', 1);
    }

    public function test_sso_callback_blocks_new_user_when_registration_disabled(): void
    {
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);

        $this->mockSocialiteUser(
            id: 'google-new',
            name: 'New User',
            email: 'new@gmail.com',
        );

        $response = $this->asSpa()->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url').'/login?error=registration_disabled');
        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['email' => 'new@gmail.com']);
    }

    public function test_sso_callback_still_logs_in_existing_user_when_registration_disabled(): void
    {
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);

        $user = User::factory()->create([
            'email' => 'ada@gmail.com',
            'password' => null,
        ]);

        SocialAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'google',
            'provider_id' => 'google-123',
        ]);

        $this->mockSocialiteUser(
            id: 'google-123',
            name: 'Ada Lovelace',
            email: 'ada@gmail.com',
        );

        $response = $this->asSpa()->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url').'/auth/callback');
        $this->assertAuthenticatedAs($user);
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

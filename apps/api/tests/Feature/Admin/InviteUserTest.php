<?php

namespace Tests\Feature\Admin;

use App\Mail\UserInvitationMail;
use App\Models\Feature;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Socialite\Contracts\Provider as SocialiteProvider;
use Laravel\Socialite\Contracts\User as SocialiteUserContract;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class InviteUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_invite_user_and_email_is_sent(): void
    {
        Mail::fake();
        $this->loginAsAdmin();

        $response = $this->asSpa()->postJson('/api/admin/invitations', [
            'name' => 'Invited User',
            'email' => 'invitee@example.com',
            'role' => 'customer',
        ]);

        $response->assertCreated()
            ->assertJsonPath('invitation.email', 'invitee@example.com')
            ->assertJsonPath('invitation.role', 'customer')
            ->assertJsonPath('message', 'Invitation sent');

        $this->assertDatabaseHas('user_invitations', [
            'email' => 'invitee@example.com',
            'role' => 'customer',
        ]);

        Mail::assertSent(UserInvitationMail::class, function (UserInvitationMail $mail) {
            return $mail->invitation->email === 'invitee@example.com';
        });
    }

    public function test_invite_works_when_registration_disabled(): void
    {
        Mail::fake();
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/invitations', [
            'name' => 'Invited Admin',
            'email' => 'invite-admin@example.com',
            'role' => 'admin',
        ])->assertCreated();
    }

    public function test_customer_cannot_invite(): void
    {
        Mail::fake();
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->postJson('/api/admin/invitations', [
            'name' => 'Invited User',
            'email' => 'invitee@example.com',
            'role' => 'customer',
        ])->assertForbidden();
    }

    public function test_pending_invitation_can_be_shown(): void
    {
        $invitation = UserInvitation::factory()->create([
            'name' => 'Pat',
            'email' => 'pat@example.com',
            'role' => 'admin',
        ]);

        $this->asSpa()->getJson('/api/invitations/'.$invitation->token)
            ->assertOk()
            ->assertJsonPath('invitation.name', 'Pat')
            ->assertJsonPath('invitation.email', 'pat@example.com')
            ->assertJsonPath('invitation.role', 'admin');
    }

    public function test_expired_invitation_cannot_be_shown(): void
    {
        $invitation = UserInvitation::factory()->expired()->create();

        $this->asSpa()->getJson('/api/invitations/'.$invitation->token)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['token']);
    }

    public function test_invitee_can_register_with_password_and_gets_admin_role(): void
    {
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);

        $invitation = UserInvitation::factory()->adminRole()->create([
            'name' => 'Pat',
            'email' => 'pat@example.com',
        ]);

        $response = $this->asSpa()->postJson('/api/invitations/'.$invitation->token.'/register', [
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'pat@example.com')
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.name', 'Pat');

        $this->assertNotNull($invitation->fresh()->accepted_at);
        $this->asSpa()->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.email', 'pat@example.com');
    }

    public function test_invitee_can_accept_via_sso_when_registration_disabled(): void
    {
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);

        $invitation = UserInvitation::factory()->create([
            'name' => 'Pat',
            'email' => 'pat@gmail.com',
            'role' => 'customer',
        ]);

        $this->mockGoogleUser('pat@gmail.com', 'google-invite-1');

        $this->withSession(['invitation_token' => $invitation->token])
            ->asSpa()
            ->get('/api/auth/google/callback')
            ->assertRedirect(config('app.frontend_url').'/auth/callback');

        $this->assertDatabaseHas('users', [
            'email' => 'pat@gmail.com',
            'role' => 'customer',
        ]);
        $this->assertNotNull($invitation->fresh()->accepted_at);
    }

    public function test_sso_invite_rejects_mismatched_email(): void
    {
        $invitation = UserInvitation::factory()->create([
            'email' => 'pat@example.com',
        ]);

        $this->mockGoogleUser('other@gmail.com', 'google-mismatch-1');

        $this->withSession(['invitation_token' => $invitation->token])
            ->asSpa()
            ->get('/api/auth/google/callback')
            ->assertRedirect();

        $this->assertDatabaseMissing('users', ['email' => 'other@gmail.com']);
        $this->assertNull($invitation->fresh()->accepted_at);
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

    private function mockGoogleUser(string $email, string $providerId): void
    {
        $socialUser = Mockery::mock(SocialiteUserContract::class);
        $socialUser->shouldReceive('getId')->andReturn($providerId);
        $socialUser->shouldReceive('getName')->andReturn('Pat');
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
    }
}

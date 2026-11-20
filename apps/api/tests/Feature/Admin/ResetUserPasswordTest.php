<?php

namespace Tests\Feature\Admin;

use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class ResetUserPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_reset_or_send_password_reset(): void
    {
        $customer = User::factory()->create();

        $this->asSpa()->putJson('/api/admin/users/'.$customer->id.'/password', [
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnauthorized();

        $this->asSpa()->postJson('/api/admin/users/'.$customer->id.'/password-reset')
            ->assertUnauthorized();
    }

    public function test_customer_cannot_reset_or_send_password_reset(): void
    {
        $actor = User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]);
        $target = User::factory()->create();

        $this->loginAs($actor);

        $this->asSpa()->putJson('/api/admin/users/'.$target->id.'/password', [
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertForbidden();

        $this->asSpa()->postJson('/api/admin/users/'.$target->id.'/password-reset')
            ->assertForbidden();
    }

    public function test_admin_can_set_password_for_customer_password_user(): void
    {
        $this->loginAsAdmin();
        $customer = User::factory()->create([
            'email' => 'casey@example.com',
            'password' => 'OldPassword1!',
        ]);

        DB::table('sessions')->insert([
            'id' => 'customer-session',
            'user_id' => $customer->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'payload' => 'test',
            'last_activity' => time(),
        ]);

        $this->asSpa()->putJson('/api/admin/users/'.$customer->id.'/password', [
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
            'must_change_password' => true,
        ])->assertOk()
            ->assertJsonPath('user.must_change_password', true);

        $this->assertTrue(Hash::check('NewPassword1!', $customer->fresh()->password));
        $this->assertTrue($customer->fresh()->must_change_password);
        $this->assertDatabaseMissing('sessions', ['user_id' => $customer->id]);
    }

    public function test_admin_set_password_revokes_outstanding_reset_tokens(): void
    {
        $this->loginAsAdmin();
        $customer = User::factory()->create([
            'email' => 'casey@example.com',
            'password' => 'OldPassword1!',
        ]);

        $token = Password::broker()->createToken($customer);

        $this->asSpa()->putJson('/api/admin/users/'.$customer->id.'/password', [
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $this->asSpa()->postJson('/api/password/reset', [
            'email' => 'casey@example.com',
            'token' => $token,
            'password' => 'HijackPass1!',
            'password_confirmation' => 'HijackPass1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->assertTrue(Hash::check('NewPassword1!', $customer->fresh()->password));
    }

    public function test_admin_with_must_change_password_cannot_use_admin_apis(): void
    {
        $admin = User::factory()->admin()->mustChangePassword()->create([
            'email' => 'temp-admin@example.com',
            'password' => 'Password1!',
        ]);
        $this->loginAs($admin);

        $this->asSpa()->getJson('/api/admin/users?role=customer')
            ->assertForbidden()
            ->assertJsonPath('message', 'Password change required');

        $this->asSpa()->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.must_change_password', true);
    }

    public function test_admin_cannot_set_password_for_admin_user(): void
    {
        $this->loginAsAdmin();
        $otherAdmin = User::factory()->admin()->create([
            'email' => 'other@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->putJson('/api/admin/users/'.$otherAdmin->id.'/password', [
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);
    }

    public function test_admin_cannot_set_password_for_sso_user(): void
    {
        $this->loginAsAdmin();
        $ssoUser = User::factory()->withoutPassword()->create([
            'email' => 'sso@example.com',
        ]);

        $this->asSpa()->putJson('/api/admin/users/'.$ssoUser->id.'/password', [
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);
    }

    public function test_admin_can_send_reset_email_to_admin_and_customer(): void
    {
        Mail::fake();
        $this->loginAsAdmin();

        $customer = User::factory()->create(['email' => 'casey@example.com']);
        $otherAdmin = User::factory()->admin()->create(['email' => 'other@example.com']);

        $this->asSpa()->postJson('/api/admin/users/'.$customer->id.'/password-reset')
            ->assertOk()
            ->assertJsonPath('email', 'casey@example.com');

        $this->asSpa()->postJson('/api/admin/users/'.$otherAdmin->id.'/password-reset')
            ->assertOk()
            ->assertJsonPath('email', 'other@example.com');

        Mail::assertSent(PasswordResetMail::class, 2);
    }

    public function test_admin_cannot_send_reset_email_to_sso_user(): void
    {
        Mail::fake();
        $this->loginAsAdmin();
        $ssoUser = User::factory()->withoutPassword()->create([
            'email' => 'sso@example.com',
        ]);

        $this->asSpa()->postJson('/api/admin/users/'.$ssoUser->id.'/password-reset')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['user']);

        Mail::assertNothingSent();
    }

    public function test_admin_can_show_user_including_has_password(): void
    {
        $this->loginAsAdmin();
        $customer = User::factory()->create(['email' => 'casey@example.com']);
        $ssoUser = User::factory()->withoutPassword()->create(['email' => 'sso@example.com']);

        $this->asSpa()->getJson('/api/admin/users/'.$customer->id)
            ->assertOk()
            ->assertJsonPath('user.has_password', true);

        $this->asSpa()->getJson('/api/admin/users/'.$ssoUser->id)
            ->assertOk()
            ->assertJsonPath('user.has_password', false);
    }

    public function test_user_list_includes_has_password(): void
    {
        $this->loginAsAdmin();
        User::factory()->create(['email' => 'with-pass@example.com']);
        User::factory()->withoutPassword()->create(['email' => 'sso@example.com']);

        $this->asSpa()->getJson('/api/admin/users?role=customer')
            ->assertOk()
            ->assertJsonFragment(['email' => 'with-pass@example.com', 'has_password' => true])
            ->assertJsonFragment(['email' => 'sso@example.com', 'has_password' => false]);
    }

    public function test_user_can_reset_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'email' => 'casey@example.com',
            'password' => 'OldPassword1!',
            'must_change_password' => true,
        ]);

        DB::table('sessions')->insert([
            'id' => 'reset-user-session',
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'payload' => 'test',
            'last_activity' => time(),
        ]);

        $token = Password::broker()->createToken($user);

        $this->asSpa()->postJson('/api/password/reset', [
            'email' => 'casey@example.com',
            'token' => $token,
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewPassword1!', $user->fresh()->password));
        $this->assertFalse($user->fresh()->must_change_password);
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);
    }

    public function test_invalid_reset_token_is_rejected(): void
    {
        User::factory()->create(['email' => 'casey@example.com']);

        $this->asSpa()->postJson('/api/password/reset', [
            'email' => 'casey@example.com',
            'token' => 'invalid-token',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_sso_user_cannot_complete_password_reset(): void
    {
        $user = User::factory()->withoutPassword()->create([
            'email' => 'sso@example.com',
        ]);

        $token = Password::broker()->createToken($user);

        $this->asSpa()->postJson('/api/password/reset', [
            'email' => 'sso@example.com',
            'token' => $token,
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->assertNull($user->fresh()->getAttributes()['password'] ?? null);
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
}

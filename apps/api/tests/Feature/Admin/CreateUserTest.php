<?php

namespace Tests\Feature\Admin;

use App\Models\Feature;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_create_user(): void
    {
        $this->asSpa()->postJson('/api/admin/users', $this->validPayload())
            ->assertUnauthorized();
    }

    public function test_customer_cannot_create_user(): void
    {
        $this->loginAs(User::factory()->create([
            'email' => 'customer@example.com',
            'password' => 'Password1!',
        ]));

        $this->asSpa()->postJson('/api/admin/users', $this->validPayload())
            ->assertForbidden();
    }

    public function test_admin_can_create_password_user_with_role(): void
    {
        $this->loginAsAdmin();

        $response = $this->asSpa()->postJson('/api/admin/users', [
            ...$this->validPayload(),
            'role' => 'admin',
            'must_change_password' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'new.admin@example.com')
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.must_change_password', true);

        $user = User::query()->where('email', 'new.admin@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue(Hash::check('TempPass1!', $user->password));
        $this->assertTrue($user->must_change_password);
    }

    public function test_admin_can_create_customer_when_registration_disabled(): void
    {
        Feature::query()->where('key', 'user_registration')->update(['enabled' => false]);
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/users', [
            ...$this->validPayload(),
            'role' => 'customer',
        ])->assertCreated()
            ->assertJsonPath('user.role', 'customer');
    }

    public function test_duplicate_email_is_rejected(): void
    {
        User::factory()->create(['email' => 'new.admin@example.com']);
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/users', $this->validPayload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_pending_invite_email_is_rejected(): void
    {
        UserInvitation::factory()->create(['email' => 'new.admin@example.com']);
        $this->loginAsAdmin();

        $this->asSpa()->postJson('/api/admin/users', $this->validPayload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_updating_password_clears_must_change_password(): void
    {
        $user = User::factory()->mustChangePassword()->create([
            'email' => 'temp@example.com',
            'password' => 'TempPass1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'temp@example.com',
            'password' => 'TempPass1!',
        ])->assertOk();

        $this->asSpa()->putJson('/api/user/password', [
            'current_password' => 'TempPass1!',
            'password' => 'NewPassword1!',
            'password_confirmation' => 'NewPassword1!',
        ])->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        $this->assertFalse($user->fresh()->must_change_password);
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'name' => 'New Admin',
            'email' => 'new.admin@example.com',
            'password' => 'TempPass1!',
            'password_confirmation' => 'TempPass1!',
            'role' => 'admin',
            'must_change_password' => false,
        ];
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

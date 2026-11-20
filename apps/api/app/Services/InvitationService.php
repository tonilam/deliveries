<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Mail\UserInvitationMail;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InvitationService
{
    public function createAndSend(
        User $inviter,
        string $name,
        string $email,
        UserRole $role,
        ?int $companyId = null,
    ): UserInvitation {
        $this->assertEmailAvailable($email);

        $invitation = UserInvitation::query()->create([
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'company_id' => $role === UserRole::Customer ? $companyId : null,
            'token' => Str::random(64),
            'invited_by' => $inviter->id,
            'expires_at' => now()->addDays(7),
        ]);

        Mail::to($invitation->email)->send(new UserInvitationMail($invitation));

        return $invitation;
    }

    public function findPending(string $token): UserInvitation
    {
        $invitation = UserInvitation::query()->where('token', $token)->first();

        if ($invitation === null || $invitation->accepted_at !== null) {
            throw ValidationException::withMessages([
                'token' => ['This invitation is invalid or has already been used.'],
            ]);
        }

        if ($invitation->isExpired()) {
            throw ValidationException::withMessages([
                'token' => ['This invitation has expired.'],
            ]);
        }

        return $invitation;
    }

    public function acceptWithPassword(UserInvitation $invitation, string $password): User
    {
        return DB::transaction(function () use ($invitation, $password): User {
            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);
            $this->assertStillPending($invitation);
            $this->assertNoExistingUser($invitation->email);

            $user = User::query()->create([
                'name' => $invitation->name,
                'email' => $invitation->email,
                'password' => $password,
                'role' => $invitation->role,
                'is_active' => true,
                'must_change_password' => false,
                'company_id' => $invitation->role === UserRole::Customer ? $invitation->company_id : null,
            ]);

            $invitation->forceFill(['accepted_at' => now()])->save();

            return $user;
        });
    }

    public function consumeForSso(UserInvitation $invitation, string $ssoEmail, ?string $ssoName): User
    {
        if (strcasecmp($invitation->email, $ssoEmail) !== 0) {
            throw ValidationException::withMessages([
                'email' => ['Sign in with the same email address that was invited ('.$invitation->email.').'],
            ]);
        }

        return DB::transaction(function () use ($invitation, $ssoEmail, $ssoName): User {
            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);
            $this->assertStillPending($invitation);
            $this->assertNoExistingUser($invitation->email);

            $user = User::query()->create([
                'name' => $ssoName ?: $invitation->name,
                'email' => $ssoEmail,
                'password' => null,
                'role' => $invitation->role,
                'is_active' => true,
                'must_change_password' => false,
                'email_verified_at' => now(),
                'company_id' => $invitation->role === UserRole::Customer ? $invitation->company_id : null,
            ]);

            $invitation->forceFill(['accepted_at' => now()])->save();

            return $user;
        });
    }

    public function assertEmailAvailable(string $email): void
    {
        $this->assertNoExistingUser($email);

        $pending = UserInvitation::query()
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages([
                'email' => ['An invitation has already been sent to this email.'],
            ]);
        }
    }

    private function assertNoExistingUser(string $email): void
    {
        if (User::query()->where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['A user with this email already exists.'],
            ]);
        }
    }

    private function assertStillPending(UserInvitation $invitation): void
    {
        if ($invitation->accepted_at !== null) {
            throw ValidationException::withMessages([
                'token' => ['This invitation is invalid or has already been used.'],
            ]);
        }

        if ($invitation->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'token' => ['This invitation has expired.'],
            ]);
        }
    }
}

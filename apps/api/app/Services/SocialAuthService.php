<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use RuntimeException;

class SocialAuthService
{
    public function findOrCreate(string $provider, SocialiteUser $socialUser): User
    {
        return DB::transaction(function () use ($provider, $socialUser): User {
            $account = SocialAccount::query()
                ->where('provider', $provider)
                ->where('provider_id', $socialUser->getId())
                ->first();

            if ($account !== null) {
                $user = $account->user;

                if ($user->role === UserRole::Admin) {
                    $this->assertAdminSsoAllowed($socialUser, $user);
                }

                return $user;
            }

            $email = $socialUser->getEmail();

            $user = $email !== null
                ? User::query()->where('email', $email)->first()
                : null;

            if ($user === null) {
                if ($email !== null) {
                    $this->assertProviderEmailVerified($provider, $socialUser);
                }

                $user = User::query()->create([
                    'name' => $socialUser->getName() ?: ($email ?? 'User'),
                    'email' => $email ?? $provider.'-'.$socialUser->getId().'@users.noreply.loadplanner.local',
                    'password' => null,
                    'role' => UserRole::Customer,
                    'is_active' => true,
                ]);

                if ($email !== null) {
                    $user->forceFill(['email_verified_at' => now()])->save();
                }
            } else {
                $this->assertProviderEmailVerified($provider, $socialUser);

                if ($user->role === UserRole::Admin) {
                    $this->assertAdminSsoAllowed($socialUser, $user);
                }
            }

            $user->socialAccounts()->create([
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
            ]);

            return $user;
        });
    }

    private function assertProviderEmailVerified(string $provider, SocialiteUser $socialUser): void
    {
        if ($provider !== 'google') {
            return;
        }

        $raw = $socialUser->getRaw() ?? [];

        $verified = ($raw['email_verified'] ?? false) === true
            || ($raw['verified_email'] ?? false) === true;

        if (! $verified) {
            throw new RuntimeException('Google email is not verified.');
        }
    }

    private function assertAdminSsoAllowed(SocialiteUser $socialUser, User $user): void
    {
        $domain = config('auth.admin_email_domain');

        if ($domain === null || $domain === '') {
            return;
        }

        $domain = ltrim(strtolower((string) $domain), '@');
        $email = strtolower($user->email);

        if (! str_ends_with($email, '@'.$domain)) {
            throw new RuntimeException('Admin email domain mismatch.');
        }

        $raw = $socialUser->getRaw() ?? [];
        $hd = isset($raw['hd']) ? strtolower((string) $raw['hd']) : null;

        if ($hd !== null && $hd !== $domain) {
            throw new RuntimeException('Google hosted domain mismatch.');
        }
    }
}

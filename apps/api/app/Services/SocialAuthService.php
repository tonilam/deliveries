<?php

namespace App\Services;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Contracts\User as SocialiteUser;

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
                return $account->user;
            }

            $email = $socialUser->getEmail();

            $user = $email !== null
                ? User::query()->where('email', $email)->first()
                : null;

            if ($user === null) {
                $user = User::query()->create([
                    'name' => $socialUser->getName() ?: ($email ?? 'User'),
                    'email' => $email ?? $provider.'-'.$socialUser->getId().'@users.noreply.loadplanner.local',
                    'password' => null,
                ]);

                if ($email !== null) {
                    $user->forceFill(['email_verified_at' => now()])->save();
                }
            }

            $user->socialAccounts()->create([
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
            ]);

            return $user;
        });
    }
}

<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class ImpersonationService
{
    public const SESSION_KEY = 'impersonator_id';

    public function isImpersonating(Request $request): bool
    {
        return $request->session()->has(self::SESSION_KEY);
    }

    public function impersonator(Request $request): ?User
    {
        $id = $request->session()->get(self::SESSION_KEY);

        if ($id === null) {
            return null;
        }

        return User::query()->find($id);
    }

    /**
     * @return array{id: int, name: string, email: string}|null
     */
    public function impersonatorPayload(Request $request): ?array
    {
        $impersonator = $this->impersonator($request);

        if ($impersonator === null) {
            return null;
        }

        return [
            'id' => $impersonator->id,
            'name' => $impersonator->name,
            'email' => $impersonator->email,
        ];
    }

    public function start(Request $request, User $target): User
    {
        if ($this->isImpersonating($request)) {
            throw ValidationException::withMessages([
                'user' => ['Already impersonating a user.'],
            ]);
        }

        if ($target->role !== UserRole::Customer) {
            throw ValidationException::withMessages([
                'user' => ['Only customer users can be impersonated.'],
            ]);
        }

        if (! $target->is_active) {
            throw ValidationException::withMessages([
                'user' => ['Inactive users cannot be impersonated.'],
            ]);
        }

        $admin = $request->user();
        if ($admin === null || $admin->role !== UserRole::Admin) {
            abort(403, 'Forbidden');
        }

        $adminId = $admin->id;

        Auth::guard('web')->login($target);
        $request->session()->regenerate();
        $request->session()->put(self::SESSION_KEY, $adminId);

        return $target;
    }

    public function leave(Request $request): User
    {
        $adminId = $request->session()->get(self::SESSION_KEY);

        if ($adminId === null) {
            throw ValidationException::withMessages([
                'user' => ['Not currently impersonating a user.'],
            ]);
        }

        $admin = User::query()->find($adminId);

        if ($admin === null || $admin->role !== UserRole::Admin || ! $admin->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'user' => ['Unable to restore the admin session.'],
            ]);
        }

        Auth::guard('web')->login($admin);
        $request->session()->regenerate();
        $request->session()->forget(self::SESSION_KEY);

        return $admin;
    }
}

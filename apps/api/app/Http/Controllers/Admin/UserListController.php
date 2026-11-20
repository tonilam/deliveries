<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserListController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::enum(UserRole::class)],
        ]);

        $role = UserRole::from($validated['role']);

        $query = User::query()
            ->where('role', $role)
            ->orderBy('name');

        if ($role === UserRole::Customer) {
            $query->with('company:id,business_name');
        }

        $users = $query
            ->get(['id', 'name', 'email', 'is_active', 'password', 'company_id'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => $user->is_active,
                'has_password' => $user->has_password,
                'company' => $user->company?->business_name,
            ]);

        return response()->json([
            'users' => $users,
        ]);
    }
}

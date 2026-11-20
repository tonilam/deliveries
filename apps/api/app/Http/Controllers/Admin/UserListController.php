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

        $users = User::query()
            ->where('role', $role)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'is_active']);

        return response()->json([
            'users' => $users,
        ]);
    }
}

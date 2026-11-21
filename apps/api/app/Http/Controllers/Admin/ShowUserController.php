<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ShowUserController extends Controller
{
    public function __invoke(AdminRequest $request, User $user): JsonResponse
    {
        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'is_active' => $user->is_active,
                'has_password' => $user->has_password,
            ],
        ]);
    }
}

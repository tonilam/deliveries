<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Models\User;
use App\Services\SessionInvalidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;

class ResetUserPasswordController extends Controller
{
    public function __construct(
        private readonly SessionInvalidationService $sessions,
    ) {}

    public function __invoke(ResetUserPasswordRequest $request, User $user): JsonResponse
    {
        $user->password = $request->string('password')->toString();
        $user->must_change_password = $request->boolean('must_change_password', true);
        $user->save();

        Password::broker()->deleteToken($user);
        $this->sessions->invalidateFor($user);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'is_active' => $user->is_active,
                'has_password' => true,
                'must_change_password' => $user->must_change_password,
            ],
            'message' => 'Password updated',
        ]);
    }
}

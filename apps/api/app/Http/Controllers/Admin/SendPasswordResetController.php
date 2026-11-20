<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class SendPasswordResetController extends Controller
{
    public function __invoke(User $user): JsonResponse
    {
        if (! $user->has_password) {
            throw ValidationException::withMessages([
                'user' => ['Password reset is not available for SSO-only users.'],
            ]);
        }

        $status = Password::broker()->sendResetLink([
            'email' => $user->email,
        ]);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password reset email sent',
            'email' => $user->email,
        ]);
    }
}

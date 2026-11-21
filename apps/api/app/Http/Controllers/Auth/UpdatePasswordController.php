<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use Illuminate\Http\JsonResponse;

class UpdatePasswordController extends Controller
{
    public function __invoke(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->password = $request->string('password')->toString();
        $user->must_change_password = false;
        $user->save();

        return response()->json([
            'user' => $user->fresh()->toAuthPayload(),
            'message' => 'Password updated',
        ]);
    }
}

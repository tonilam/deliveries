<?php

namespace App\Http\Controllers\Auth;

use App\Enums\FeatureKey;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RegisterController extends Controller
{
    public function __construct(
        private readonly FeatureService $features,
    ) {}

    public function __invoke(RegisterRequest $request): JsonResponse
    {
        if (! $this->features->isEnabled(FeatureKey::UserRegistration)) {
            return response()->json([
                'message' => 'User registration is currently disabled.',
            ], 403);
        }

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
            'role' => UserRole::Customer,
            'is_active' => true,
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'user' => $user,
        ], 201);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateUserRequest;
use App\Models\User;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;

class CreateUserController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    public function __invoke(CreateUserRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString();
        $this->invitations->assertEmailAvailable($email);

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $email,
            'password' => $request->string('password')->toString(),
            'role' => UserRole::from($request->string('role')->toString()),
            'is_active' => true,
            'must_change_password' => $request->boolean('must_change_password'),
        ]);

        return response()->json([
            'user' => $user,
        ], 201);
    }
}

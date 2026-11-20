<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\InviteUserRequest;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;

class InviteUserController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    public function __invoke(InviteUserRequest $request): JsonResponse
    {
        $invitation = $this->invitations->createAndSend(
            $request->user(),
            $request->string('name')->toString(),
            $request->string('email')->toString(),
            UserRole::from($request->string('role')->toString()),
        );

        return response()->json([
            'invitation' => [
                'id' => $invitation->id,
                'name' => $invitation->name,
                'email' => $invitation->email,
                'role' => $invitation->role->value,
                'expires_at' => $invitation->expires_at->toIso8601String(),
            ],
            'message' => 'Invitation sent',
        ], 201);
    }
}

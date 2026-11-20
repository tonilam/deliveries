<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;

class ShowInvitationController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    public function __invoke(string $token): JsonResponse
    {
        $invitation = $this->invitations->findPending($token);

        return response()->json([
            'invitation' => [
                'name' => $invitation->name,
                'email' => $invitation->email,
                'role' => $invitation->role->value,
                'expires_at' => $invitation->expires_at->toIso8601String(),
            ],
        ]);
    }
}

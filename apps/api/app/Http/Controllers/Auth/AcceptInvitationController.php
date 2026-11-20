<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class AcceptInvitationController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
    ) {}

    public function __invoke(AcceptInvitationRequest $request, string $token): JsonResponse
    {
        $invitation = $this->invitations->findPending($token);
        $user = $this->invitations->acceptWithPassword(
            $invitation,
            $request->string('password')->toString(),
        );

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'user' => $user,
        ], 201);
    }
}

<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\ImpersonationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveImpersonationController extends Controller
{
    public function __construct(
        private readonly ImpersonationService $impersonation,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $admin = $this->impersonation->leave($request);

        return response()->json([
            'user' => $admin,
            'impersonating' => false,
            'impersonator' => null,
            'message' => 'Returned to admin session',
        ]);
    }
}

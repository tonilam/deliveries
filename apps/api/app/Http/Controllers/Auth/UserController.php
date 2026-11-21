<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\ImpersonationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        private readonly ImpersonationService $impersonation,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $impersonating = $this->impersonation->isImpersonating($request);

        return response()->json([
            'user' => $request->user()?->toAuthPayload(),
            'impersonating' => $impersonating,
            'impersonator' => $impersonating
                ? $this->impersonation->impersonatorPayload($request)
                : null,
        ]);
    }
}

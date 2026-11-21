<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\User;
use App\Services\ImpersonationService;
use Illuminate\Http\JsonResponse;

class ImpersonateUserController extends Controller
{
    public function __construct(
        private readonly ImpersonationService $impersonation,
    ) {}

    public function __invoke(AdminRequest $request, User $user): JsonResponse
    {
        $target = $this->impersonation->start($request, $user);

        return response()->json([
            'user' => $target->toAuthPayload(),
            'impersonating' => true,
            'impersonator' => $this->impersonation->impersonatorPayload($request),
            'message' => 'Now impersonating user',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ShowUserController extends Controller
{
    public function __invoke(AdminRequest $request, User $user): JsonResponse
    {
        return response()->json([
            'user' => $user->toAdminPayload(),
        ]);
    }
}

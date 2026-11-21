<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\GoodType;
use Illuminate\Http\JsonResponse;

class ShowGoodTypeController extends Controller
{
    public function __invoke(AdminRequest $request, GoodType $goodType): JsonResponse
    {
        return response()->json([
            'good_type' => $goodType->toAdminPayload(),
        ]);
    }
}

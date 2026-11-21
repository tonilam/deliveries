<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\GoodType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class DeleteGoodTypeController extends Controller
{
    public function __invoke(AdminRequest $request, GoodType $goodType): Response|JsonResponse
    {
        $goodType->delete();

        return response()->noContent();
    }
}

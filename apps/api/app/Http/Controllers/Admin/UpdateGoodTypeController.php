<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateGoodTypeRequest;
use App\Models\GoodType;
use Illuminate\Http\JsonResponse;

class UpdateGoodTypeController extends Controller
{
    public function __invoke(UpdateGoodTypeRequest $request, GoodType $goodType): JsonResponse
    {
        $goodType->update([
            'name' => $request->string('name')->toString(),
            'refrigerated_required' => $request->boolean('refrigerated_required'),
        ]);

        return response()->json([
            'good_type' => $goodType->fresh()->toAdminPayload(),
        ]);
    }
}

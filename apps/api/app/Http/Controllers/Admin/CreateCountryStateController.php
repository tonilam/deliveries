<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCountryStateRequest;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class CreateCountryStateController extends Controller
{
    public function __invoke(StoreCountryStateRequest $request, Country $country): JsonResponse
    {
        $state = $country->states()->create([
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
        ]);

        return response()->json([
            'state' => $state,
        ], 201);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateCountryStateRequest;
use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Http\JsonResponse;

class UpdateCountryStateController extends Controller
{
    public function __invoke(
        UpdateCountryStateRequest $request,
        Country $country,
        CountryState $state,
    ): JsonResponse {
        $state->update([
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
        ]);

        return response()->json([
            'state' => $state->fresh(),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateCountryRequest;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class UpdateCountryController extends Controller
{
    public function __invoke(UpdateCountryRequest $request, Country $country): JsonResponse
    {
        $country->update([
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
        ]);

        $country->load('states');

        return response()->json([
            'country' => $country,
        ]);
    }
}

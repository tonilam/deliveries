<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCountryRequest;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class CreateCountryController extends Controller
{
    public function __invoke(StoreCountryRequest $request): JsonResponse
    {
        $country = Country::query()->create([
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
        ]);

        $country->load('states');

        return response()->json([
            'country' => $country,
        ], 201);
    }
}

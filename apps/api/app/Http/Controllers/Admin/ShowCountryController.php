<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class ShowCountryController extends Controller
{
    public function __invoke(Country $country): JsonResponse
    {
        $country->load('states');

        return response()->json([
            'country' => $country,
        ]);
    }
}

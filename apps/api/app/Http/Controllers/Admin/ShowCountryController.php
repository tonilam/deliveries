<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class ShowCountryController extends Controller
{
    public function __invoke(AdminRequest $request, Country $country): JsonResponse
    {
        $country->load('states');

        return response()->json([
            'country' => $country,
        ]);
    }
}

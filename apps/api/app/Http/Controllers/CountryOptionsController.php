<?php

namespace App\Http\Controllers;

use App\Models\Country;
use Illuminate\Http\JsonResponse;

class CountryOptionsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $countries = Country::query()
            ->select(['id', 'name', 'code'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'countries' => $countries,
        ]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class CountryListController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $countries = Country::query()
            ->with('states')
            ->orderBy('name')
            ->get();

        return response()->json([
            'countries' => $countries,
        ]);
    }
}

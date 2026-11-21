<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\Country;
use Illuminate\Http\JsonResponse;

class CountryListController extends Controller
{
    public function __invoke(AdminRequest $request): JsonResponse
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

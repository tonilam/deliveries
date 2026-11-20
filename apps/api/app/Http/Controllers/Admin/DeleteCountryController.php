<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class DeleteCountryController extends Controller
{
    public function __invoke(Country $country): Response|JsonResponse
    {
        $country->delete();

        return response()->noContent();
    }
}

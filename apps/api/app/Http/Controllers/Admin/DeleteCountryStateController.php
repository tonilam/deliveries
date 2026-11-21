<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Http\Response;

class DeleteCountryStateController extends Controller
{
    public function __invoke(Country $country, CountryState $state): Response
    {
        $state->delete();

        return response()->noContent();
    }
}

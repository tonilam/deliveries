<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Http\Response;

class DeleteCountryStateController extends Controller
{
    public function __invoke(AdminRequest $request, Country $country, CountryState $state): Response
    {
        $state->delete();

        return response()->noContent();
    }
}

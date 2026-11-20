<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeleteCountryStateController extends Controller
{
    public function __invoke(Country $country, CountryState $state): Response
    {
        if ($state->country_id !== $country->id) {
            throw new NotFoundHttpException;
        }

        $state->delete();

        return response()->noContent();
    }
}

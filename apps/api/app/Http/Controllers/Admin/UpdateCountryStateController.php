<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateCountryStateRequest;
use App\Models\Country;
use App\Models\CountryState;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateCountryStateController extends Controller
{
    public function __invoke(
        UpdateCountryStateRequest $request,
        Country $country,
        CountryState $state,
    ): JsonResponse {
        $this->assertStateBelongsToCountry($country, $state);

        $state->update([
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
        ]);

        return response()->json([
            'state' => $state->fresh(),
        ]);
    }

    private function assertStateBelongsToCountry(Country $country, CountryState $state): void
    {
        if ($state->country_id !== $country->id) {
            throw new NotFoundHttpException;
        }
    }
}

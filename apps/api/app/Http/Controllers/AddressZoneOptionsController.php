<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddressZoneOptionsRequest;
use App\Models\Company;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class AddressZoneOptionsController extends Controller
{
    public function __invoke(AddressZoneOptionsRequest $request): JsonResponse
    {
        /** @var Company|null $company */
        $company = Company::query()->find($request->user()->company_id);
        if ($company === null || $company->country_id === null) {
            return response()->json([
                'zones' => [],
            ]);
        }

        $zones = Zone::query()
            ->where('country_id', $company->country_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->orderBy('id')
            ->get()
            ->map(static fn (Zone $zone) => $zone->toOptionPayload())
            ->values()
            ->all();

        return response()->json([
            'zones' => $zones,
        ]);
    }
}

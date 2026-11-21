<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListZoneOptionsRequest;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class ZoneOptionsController extends Controller
{
    public function __invoke(ListZoneOptionsRequest $request): JsonResponse
    {
        $query = Zone::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->orderBy('id');

        $countryId = $request->countryId();
        if ($countryId !== null) {
            $query->where('country_id', $countryId);
        }

        $zones = $query
            ->get()
            ->map(static fn (Zone $zone) => $zone->toOptionPayload())
            ->values()
            ->all();

        return response()->json([
            'zones' => $zones,
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressZoneOptionsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null || $user->role !== UserRole::Customer || $user->company_id === null) {
            abort(403);
        }

        /** @var Company|null $company */
        $company = Company::query()->find($user->company_id);
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

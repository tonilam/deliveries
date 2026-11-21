<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateZoneRequest;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class UpdateZoneController extends Controller
{
    public function __invoke(UpdateZoneRequest $request, Zone $zone): JsonResponse
    {
        $zone->update([
            'country_id' => $request->integer('country_id'),
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
            'is_active' => $request->boolean('is_active'),
        ]);

        $zone->load(['country' => static fn ($q) => $q->select('id', 'name', 'code')]);

        return response()->json([
            'zone' => $zone->toAdminPayload(),
        ]);
    }
}

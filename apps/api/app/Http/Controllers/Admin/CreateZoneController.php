<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreZoneRequest;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class CreateZoneController extends Controller
{
    public function __invoke(StoreZoneRequest $request): JsonResponse
    {
        $zone = Zone::query()->create([
            'country_id' => $request->integer('country_id'),
            'name' => $request->string('name')->toString(),
            'code' => $request->string('code')->toString(),
            'is_active' => $request->boolean('is_active', true),
        ]);

        $zone->load(['country' => static fn ($q) => $q->select('id', 'name', 'code')]);

        return response()->json([
            'zone' => $zone->toAdminPayload(),
        ], 201);
    }
}

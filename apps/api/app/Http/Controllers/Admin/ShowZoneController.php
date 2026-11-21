<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class ShowZoneController extends Controller
{
    public function __invoke(Zone $zone): JsonResponse
    {
        $zone->load(['country' => static fn ($q) => $q->select('id', 'name', 'code')]);

        return response()->json([
            'zone' => $zone->toAdminPayload(),
        ]);
    }
}

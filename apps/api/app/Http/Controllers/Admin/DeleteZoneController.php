<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class DeleteZoneController extends Controller
{
    public function __invoke(Zone $zone): Response|JsonResponse
    {
        $zone->delete();

        return response()->noContent();
    }
}

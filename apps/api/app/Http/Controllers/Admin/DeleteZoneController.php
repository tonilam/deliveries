<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class DeleteZoneController extends Controller
{
    public function __invoke(AdminRequest $request, Zone $zone): Response|JsonResponse
    {
        $zone->delete();

        return response()->noContent();
    }
}

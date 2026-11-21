<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $database = 'ok';

        try {
            DB::connection()->getPdo();
        } catch (Throwable) {
            $database = 'unavailable';
        }

        return response()->json([
            'status' => 'ok',
            'service' => 'loadplanner-api',
            'database' => $database,
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}

<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    $database = 'ok';

    try {
        DB::connection()->getPdo();
    } catch (Throwable $e) {
        $database = 'unavailable';
    }

    return response()->json([
        'status' => 'ok',
        'service' => 'loadplanner-api',
        'database' => $database,
        'timestamp' => now()->toIso8601String(),
    ]);
});

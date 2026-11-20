<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'loadplanner-api',
        'docs' => '/api/health',
    ]);
});

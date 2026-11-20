<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\UserController;
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

Route::post('/register', RegisterController::class);
Route::post('/login', LoginController::class)->middleware('throttle:5,1');

Route::get('/auth/{provider}/redirect', [SocialAuthController::class, 'redirect']);
Route::get('/auth/{provider}/callback', [SocialAuthController::class, 'callback']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', UserController::class);
    Route::post('/logout', LogoutController::class);
});

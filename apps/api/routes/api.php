<?php

use App\Http\Controllers\Admin\CreateUserController;
use App\Http\Controllers\Admin\FeatureListController;
use App\Http\Controllers\Admin\InviteUserController;
use App\Http\Controllers\Admin\ResetUserPasswordController;
use App\Http\Controllers\Admin\SendPasswordResetController;
use App\Http\Controllers\Admin\ShowUserController;
use App\Http\Controllers\Admin\UpdateFeatureController;
use App\Http\Controllers\Admin\UserListController;
use App\Http\Controllers\Auth\AcceptInvitationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\Auth\ShowInvitationController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\UpdatePasswordController;
use App\Http\Controllers\Auth\UserController;
use App\Http\Controllers\FeatureFlagsController;
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

Route::get('/features', FeatureFlagsController::class);

Route::post('/register', RegisterController::class);
Route::post('/login', LoginController::class)->middleware('throttle:5,1');
Route::post('/password/reset', ResetPasswordController::class)->middleware('throttle:5,1');

Route::get('/invitations/{token}', ShowInvitationController::class);
Route::post('/invitations/{token}/register', AcceptInvitationController::class);

Route::get('/auth/{provider}/redirect', [SocialAuthController::class, 'redirect']);
Route::get('/auth/{provider}/callback', [SocialAuthController::class, 'callback']);

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/user', UserController::class);
    Route::put('/user/password', UpdatePasswordController::class);
    Route::post('/logout', LogoutController::class);
});

Route::middleware(['auth:sanctum', 'active', 'admin', 'password.changed'])->prefix('admin')->group(function () {
    Route::get('/ping', fn () => response()->json(['ok' => true]));
    Route::get('/users', UserListController::class);
    Route::post('/users', CreateUserController::class);
    Route::get('/users/{user}', ShowUserController::class);
    Route::put('/users/{user}/password', ResetUserPasswordController::class);
    Route::post('/users/{user}/password-reset', SendPasswordResetController::class);
    Route::post('/invitations', InviteUserController::class);
    Route::get('/features', FeatureListController::class);
    Route::patch('/features/{key}', UpdateFeatureController::class);
});

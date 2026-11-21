<?php

use App\Http\Controllers\AddressListController;
use App\Http\Controllers\AddressStateOptionsController;
use App\Http\Controllers\AddressZoneOptionsController;
use App\Http\Controllers\Admin\AdminCompanyNetworkCandidatesController;
use App\Http\Controllers\Admin\AdminCompanyNetworkListController;
use App\Http\Controllers\Admin\CheckCompanyUniquenessController;
use App\Http\Controllers\Admin\CompanyListController;
use App\Http\Controllers\Admin\CountryListController;
use App\Http\Controllers\Admin\CreateCompanyController;
use App\Http\Controllers\Admin\CreateCountryController;
use App\Http\Controllers\Admin\CreateCountryStateController;
use App\Http\Controllers\Admin\CreateUserController;
use App\Http\Controllers\Admin\CreateVehicleBodyTypeController;
use App\Http\Controllers\Admin\CreateVehicleBodyTypeOptionController;
use App\Http\Controllers\Admin\CreateVehicleCategoryController;
use App\Http\Controllers\Admin\CreateZoneController;
use App\Http\Controllers\Admin\DeleteCountryController;
use App\Http\Controllers\Admin\DeleteCountryStateController;
use App\Http\Controllers\Admin\DeleteVehicleBodyTypeController;
use App\Http\Controllers\Admin\DeleteVehicleBodyTypeOptionController;
use App\Http\Controllers\Admin\DeleteVehicleCategoryController;
use App\Http\Controllers\Admin\DeleteZoneController;
use App\Http\Controllers\Admin\FeatureListController;
use App\Http\Controllers\Admin\ImpersonateUserController;
use App\Http\Controllers\Admin\InviteUserController;
use App\Http\Controllers\Admin\LinkAdminCompanyNetworkController;
use App\Http\Controllers\Admin\ResetUserPasswordController;
use App\Http\Controllers\Admin\SendPasswordResetController;
use App\Http\Controllers\Admin\ShowCompanyController;
use App\Http\Controllers\Admin\ShowCountryController;
use App\Http\Controllers\Admin\ShowUserController;
use App\Http\Controllers\Admin\ShowVehicleBodyTypeController;
use App\Http\Controllers\Admin\ShowVehicleCategoryController;
use App\Http\Controllers\Admin\ShowZoneController;
use App\Http\Controllers\Admin\UpdateCompanyController;
use App\Http\Controllers\Admin\UpdateCountryController;
use App\Http\Controllers\Admin\UpdateCountryStateController;
use App\Http\Controllers\Admin\UpdateFeatureController;
use App\Http\Controllers\Admin\UpdateVehicleBodyTypeController;
use App\Http\Controllers\Admin\UpdateVehicleBodyTypeOptionController;
use App\Http\Controllers\Admin\UpdateVehicleCategoryController;
use App\Http\Controllers\Admin\UpdateZoneController;
use App\Http\Controllers\Admin\UserListController;
use App\Http\Controllers\Admin\VehicleBodyTypeListController;
use App\Http\Controllers\Admin\VehicleBodyTypeOptionListController;
use App\Http\Controllers\Admin\VehicleCategoryListController;
use App\Http\Controllers\Admin\ZoneListController;
use App\Http\Controllers\Admin\ZoneOptionsController;
use App\Http\Controllers\Auth\AcceptInvitationController;
use App\Http\Controllers\Auth\LeaveImpersonationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\Auth\ShowInvitationController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\UpdatePasswordController;
use App\Http\Controllers\Auth\UserController;
use App\Http\Controllers\CheckNetworkCompanyUniquenessController;
use App\Http\Controllers\CountryOptionsController;
use App\Http\Controllers\CreateAddressController;
use App\Http\Controllers\CreateNetworkCompanyController;
use App\Http\Controllers\CreateRateCardController;
use App\Http\Controllers\DeleteAddressController;
use App\Http\Controllers\DeleteNetworkCompanyController;
use App\Http\Controllers\FeatureFlagsController;
use App\Http\Controllers\NetworkCompanyListController;
use App\Http\Controllers\RateCardCompanyOptionsController;
use App\Http\Controllers\RateCardListController;
use App\Http\Controllers\RegistrationCompaniesController;
use App\Http\Controllers\ShowAddressController;
use App\Http\Controllers\ShowNetworkCompanyController;
use App\Http\Controllers\ShowRateCardController;
use App\Http\Controllers\UpdateAddressController;
use App\Http\Controllers\UpdateNetworkCompanyController;
use App\Http\Controllers\UpdateRateCardController;
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

Route::get('/registration/companies', RegistrationCompaniesController::class)->middleware('throttle:20,1');
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
    Route::post('/impersonation/leave', LeaveImpersonationController::class);

    Route::get('/countries', CountryOptionsController::class);
    Route::get('/addresses', AddressListController::class);
    Route::get('/addresses/state-options', AddressStateOptionsController::class);
    Route::get('/addresses/zone-options', AddressZoneOptionsController::class);
    Route::post('/addresses', CreateAddressController::class);
    Route::get('/addresses/{address}', ShowAddressController::class);
    Route::put('/addresses/{address}', UpdateAddressController::class);
    Route::delete('/addresses/{address}', DeleteAddressController::class);

    Route::get('/rate-cards/company-options', RateCardCompanyOptionsController::class);
    Route::get('/rate-cards', RateCardListController::class);
    Route::post('/rate-cards', CreateRateCardController::class);
    Route::get('/rate-cards/{rateCard}', ShowRateCardController::class);
    Route::put('/rate-cards/{rateCard}', UpdateRateCardController::class);

    Route::get('/network/companies', NetworkCompanyListController::class);
    Route::post('/network/companies', CreateNetworkCompanyController::class);
    Route::post('/network/companies/check-uniqueness', CheckNetworkCompanyUniquenessController::class);
    Route::get('/network/companies/{company}', ShowNetworkCompanyController::class);
    Route::put('/network/companies/{company}', UpdateNetworkCompanyController::class);
    Route::delete('/network/companies/{company}', DeleteNetworkCompanyController::class);
});

Route::middleware(['auth:sanctum', 'active', 'admin', 'password.changed'])->prefix('admin')->scopeBindings()->group(function () {
    Route::get('/ping', fn () => response()->json(['ok' => true]));
    Route::get('/users', UserListController::class);
    Route::post('/users', CreateUserController::class);
    Route::get('/users/{user}', ShowUserController::class);
    Route::put('/users/{user}/password', ResetUserPasswordController::class);
    Route::post('/users/{user}/password-reset', SendPasswordResetController::class);
    Route::post('/users/{user}/impersonate', ImpersonateUserController::class);
    Route::post('/invitations', InviteUserController::class);
    Route::get('/companies', CompanyListController::class);
    Route::post('/companies', CreateCompanyController::class);
    Route::post('/companies/check-uniqueness', CheckCompanyUniquenessController::class);
    Route::get('/companies/{company}/network/candidates', AdminCompanyNetworkCandidatesController::class);
    Route::get('/companies/{company}/network', AdminCompanyNetworkListController::class);
    Route::post('/companies/{company}/network', LinkAdminCompanyNetworkController::class);
    Route::get('/companies/{company}', ShowCompanyController::class);
    Route::put('/companies/{company}', UpdateCompanyController::class);
    Route::get('/vehicle-categories', VehicleCategoryListController::class);
    Route::post('/vehicle-categories', CreateVehicleCategoryController::class);
    Route::get('/vehicle-categories/{vehicleCategory}', ShowVehicleCategoryController::class);
    Route::put('/vehicle-categories/{vehicleCategory}', UpdateVehicleCategoryController::class);
    Route::delete('/vehicle-categories/{vehicleCategory}', DeleteVehicleCategoryController::class);
    Route::get('/vehicle-categories/{vehicleCategory}/body-types', VehicleBodyTypeListController::class);
    Route::post('/vehicle-categories/{vehicleCategory}/body-types', CreateVehicleBodyTypeController::class);
    Route::get('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}', ShowVehicleBodyTypeController::class);
    Route::put('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}', UpdateVehicleBodyTypeController::class);
    Route::delete('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}', DeleteVehicleBodyTypeController::class);
    Route::get('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}/options', VehicleBodyTypeOptionListController::class);
    Route::post('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}/options', CreateVehicleBodyTypeOptionController::class);
    Route::put('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}/options/{option}', UpdateVehicleBodyTypeOptionController::class);
    Route::delete('/vehicle-categories/{vehicleCategory}/body-types/{bodyType}/options/{option}', DeleteVehicleBodyTypeOptionController::class);
    Route::get('/countries', CountryListController::class);
    Route::post('/countries', CreateCountryController::class);
    Route::get('/countries/{country}', ShowCountryController::class);
    Route::put('/countries/{country}', UpdateCountryController::class);
    Route::delete('/countries/{country}', DeleteCountryController::class);
    Route::post('/countries/{country}/states', CreateCountryStateController::class);
    Route::put('/countries/{country}/states/{state}', UpdateCountryStateController::class);
    Route::delete('/countries/{country}/states/{state}', DeleteCountryStateController::class);
    Route::get('/zones', ZoneListController::class);
    Route::get('/zones/options', ZoneOptionsController::class);
    Route::post('/zones', CreateZoneController::class);
    Route::get('/zones/{zone}', ShowZoneController::class);
    Route::put('/zones/{zone}', UpdateZoneController::class);
    Route::delete('/zones/{zone}', DeleteZoneController::class);
    Route::get('/features', FeatureListController::class);
    Route::patch('/features/{key}', UpdateFeatureController::class);
});

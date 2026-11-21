<?php

namespace App\Routing;

use App\Enums\CompanyType;
use App\Enums\UserRole;
use App\Models\Address;
use App\Models\Company;
use App\Models\Item;
use App\Models\Load;
use App\Models\RateCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

final class RouteBindingRegistrar
{
    public static function register(): void
    {
        Route::bind('address', static function (string $value): Address {
            $request = request();
            if (! self::isCustomerAddressRoute($request)) {
                return Address::query()->whereKey($value)->firstOrFail();
            }

            $user = $request->user();
            if ($user?->role !== UserRole::Customer || $user->company_id === null) {
                return Address::query()->whereKey($value)->firstOrFail();
            }

            return Address::query()
                ->where('company_id', $user->company_id)
                ->whereKey($value)
                ->firstOrFail();
        });

        Route::bind('load', static function (string $value): Load {
            $request = request();
            if (! self::isCustomerLoadRoute($request)) {
                return Load::query()->whereKey($value)->firstOrFail();
            }

            $user = $request->user();
            if ($user?->role !== UserRole::Customer || $user->company_id === null) {
                return Load::query()->whereKey($value)->firstOrFail();
            }

            return Load::query()
                ->where('company_id', $user->company_id)
                ->whereKey($value)
                ->firstOrFail();
        });

        Route::bind('item', static function (string $value): Item {
            $request = request();
            if (! self::isCustomerItemRoute($request)) {
                return Item::query()->whereKey($value)->firstOrFail();
            }

            $user = $request->user();
            if ($user?->role !== UserRole::Customer || $user->company_id === null) {
                return Item::query()->whereKey($value)->firstOrFail();
            }

            return Item::query()
                ->where('company_id', $user->company_id)
                ->whereKey($value)
                ->firstOrFail();
        });

        Route::bind('rateCard', static function (string $value): RateCard {
            $request = request();
            if (! $request->is('api/rate-cards/*')) {
                return RateCard::query()->whereKey($value)->firstOrFail();
            }

            $user = $request->user();
            if ($user?->role !== UserRole::Customer || $user->company_id === null) {
                return RateCard::query()->whereKey($value)->firstOrFail();
            }

            return RateCard::query()
                ->where('company_id', $user->company_id)
                ->whereKey($value)
                ->firstOrFail();
        });

        Route::bind('company', static function (string $value): Company {
            $request = request();
            if (self::isCustomerNetworkCompanyRoute($request)) {
                $user = $request->user();
                if ($user?->role === UserRole::Customer && $user->company_id !== null) {
                    return Company::query()
                        ->where('parent_company_id', $user->company_id)
                        ->whereKey($value)
                        ->where('company_type', '!=', CompanyType::Broker)
                        ->firstOrFail();
                }
            }

            return Company::query()->whereKey($value)->firstOrFail();
        });
    }

    private static function isCustomerAddressRoute(Request $request): bool
    {
        return $request->is('api/addresses/*');
    }

    private static function isCustomerItemRoute(Request $request): bool
    {
        return $request->is('api/items/*')
            || (bool) preg_match('#^api/loads/\d+/items/\d+(/move)?$#', $request->path());
    }

    private static function isCustomerLoadRoute(Request $request): bool
    {
        return $request->is('api/loads/*');
    }

    private static function isCustomerNetworkCompanyRoute(Request $request): bool
    {
        return (bool) preg_match('#^api/network/companies/\d+$#', $request->path());
    }
}

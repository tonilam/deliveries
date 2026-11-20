<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressListController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user?->role === UserRole::Customer && $user->company_id !== null, 403);

        $addresses = Address::query()
            ->where('company_id', $user->company_id)
            ->orderBy('business_name')
            ->get(['id', 'type', 'business_name', 'address', 'zone', 'state', 'postcode']);

        return response()->json([
            'addresses' => $addresses,
        ]);
    }
}

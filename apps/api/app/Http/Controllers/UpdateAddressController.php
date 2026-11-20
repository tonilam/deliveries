<?php

namespace App\Http\Controllers;

use App\Enums\AddressType;
use App\Http\Requests\UpdateAddressRequest;
use App\Models\Address;
use Illuminate\Http\JsonResponse;

class UpdateAddressController extends Controller
{
    public function __invoke(UpdateAddressRequest $request, Address $address): JsonResponse
    {
        $address->fill([
            'type' => AddressType::from($request->string('type')->toString()),
            'business_name' => $request->string('business_name')->toString(),
            'address' => $request->string('address')->toString(),
            'zone' => $request->string('zone')->toString(),
            'state' => $request->string('state')->toString(),
            'postcode' => $request->string('postcode')->toString(),
        ])->save();

        return response()->json([
            'address' => $address->fresh()?->toCustomerPayload(),
        ]);
    }
}

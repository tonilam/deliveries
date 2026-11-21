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
            'zone_id' => $request->integer('zone_id'),
            'state' => $request->string('state')->toString(),
            'postcode' => $request->string('postcode')->toString(),
        ])->save();

        $address->refresh()->load('zone');

        return response()->json([
            'address' => $address->toCustomerPayload(),
        ]);
    }
}

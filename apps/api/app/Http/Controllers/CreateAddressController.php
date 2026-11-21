<?php

namespace App\Http\Controllers;

use App\Enums\AddressType;
use App\Http\Requests\StoreAddressRequest;
use App\Models\Address;
use Illuminate\Http\JsonResponse;

class CreateAddressController extends Controller
{
    public function __invoke(StoreAddressRequest $request): JsonResponse
    {
        $address = Address::query()->create([
            'company_id' => $request->user()->company_id,
            'type' => AddressType::from($request->string('type')->toString()),
            'business_name' => $request->string('business_name')->toString(),
            'address' => $request->string('address')->toString(),
            'zone_id' => $request->integer('zone_id'),
            'state' => $request->string('state')->toString(),
            'postcode' => $request->string('postcode')->toString(),
        ]);

        $address->load('zone');

        return response()->json([
            'address' => $address->toCustomerPayload(),
        ], 201);
    }
}

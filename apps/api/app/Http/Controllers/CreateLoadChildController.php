<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\StoreLoadChildRequest;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class CreateLoadChildController extends Controller
{
    public function __invoke(StoreLoadChildRequest $request, Load $load): JsonResponse
    {
        $type = LoadType::from($request->string('type')->toString());

        $child = Load::query()->create([
            'company_id' => $load->company_id,
            'parent_load_id' => $load->id,
            'type' => $type,
            'customer_company_id' => $load->customer_company_id,
            'provider_company_id' => $load->provider_company_id,
            'secondary_provider_company_id' => $type === LoadType::XDock
                ? $request->integer('secondary_provider_company_id')
                : null,
            'collection_address_id' => $load->collection_address_id,
            'delivery_address_id' => $request->integer('delivery_address_id'),
            'xdock_address_id' => $type === LoadType::XDock
                ? $request->integer('xdock_address_id')
                : null,
            'pallet_count' => $request->integer('pallet_count'),
            'pickup_date' => $request->string('pickup_date')->toString(),
            'pickup_time' => $request->string('pickup_time')->toString(),
            'dropoff_date' => $request->string('dropoff_date')->toString(),
            'dropoff_time' => $request->string('dropoff_time')->toString(),
        ]);

        return response()->json([
            'load' => $child->fresh()->toCustomerPayload(false),
        ], 201);
    }
}

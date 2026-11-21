<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\StoreLoadRequest;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class CreateLoadController extends Controller
{
    public function __invoke(StoreLoadRequest $request): JsonResponse
    {
        $parties = $request->resolvedPartyIds();

        $load = Load::query()->create([
            'company_id' => $request->user()->company_id,
            'parent_load_id' => null,
            'type' => LoadType::Direct,
            'customer_company_id' => $parties['customer_company_id'],
            'provider_company_id' => $parties['provider_company_id'],
            'collection_address_id' => $request->integer('collection_address_id'),
            'delivery_address_id' => $request->integer('delivery_address_id'),
            'pallet_count' => $request->integer('pallet_count'),
            'pickup_date' => $request->string('pickup_date')->toString(),
            'pickup_time' => $request->string('pickup_time')->toString(),
            'dropoff_date' => $request->string('dropoff_date')->toString(),
            'dropoff_time' => $request->string('dropoff_time')->toString(),
        ]);

        return response()->json([
            'load' => $load->fresh()->toCustomerPayload(true),
        ], 201);
    }
}

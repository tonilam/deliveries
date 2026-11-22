<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\UpdateLoadRequest;
use App\Models\Load;
use App\Services\LoadActivityLogger;
use Illuminate\Http\JsonResponse;

class UpdateLoadController extends Controller
{
    public function __invoke(UpdateLoadRequest $request, Load $load, LoadActivityLogger $activityLogger): JsonResponse
    {
        $before = $activityLogger->displaySnapshot($load);

        if ($load->type === LoadType::Direct) {
            $parties = $request->resolvedPartyIds();
            $truck = $request->resolvedTruckTypeFields();
            $load->fill([
                'customer_company_id' => $parties['customer_company_id'],
                'provider_company_id' => $parties['provider_company_id'],
                'collection_address_id' => $request->integer('collection_address_id'),
                'delivery_address_id' => $request->integer('delivery_address_id'),
                'pallet_count' => $request->integer('pallet_count'),
                'pickup_date' => $request->string('pickup_date')->toString(),
                'pickup_time' => $request->string('pickup_time')->toString(),
                'dropoff_date' => $request->string('dropoff_date')->toString(),
                'dropoff_time' => $request->string('dropoff_time')->toString(),
                'vehicle_body_type_id' => $truck['vehicle_body_type_id'],
                'vehicle_option_values' => $truck['vehicle_option_values'],
            ]);
        } elseif ($load->type === LoadType::AddDrop) {
            $load->fill([
                'delivery_address_id' => $request->integer('delivery_address_id'),
                'pallet_count' => $request->integer('pallet_count'),
                'pickup_date' => $request->string('pickup_date')->toString(),
                'pickup_time' => $request->string('pickup_time')->toString(),
                'dropoff_date' => $request->string('dropoff_date')->toString(),
                'dropoff_time' => $request->string('dropoff_time')->toString(),
            ]);
        } else {
            $load->fill([
                'delivery_address_id' => $request->integer('delivery_address_id'),
                'xdock_address_id' => $request->integer('xdock_address_id'),
                'secondary_provider_company_id' => $request->integer('secondary_provider_company_id'),
                'pallet_count' => $request->integer('pallet_count'),
                'pickup_date' => $request->string('pickup_date')->toString(),
                'pickup_time' => $request->string('pickup_time')->toString(),
                'dropoff_date' => $request->string('dropoff_date')->toString(),
                'dropoff_time' => $request->string('dropoff_time')->toString(),
            ]);
        }

        $load->save();
        $activityLogger->updated($load, $request->user(), $before);

        $includeChildren = $load->type === LoadType::Direct;

        return response()->json([
            'load' => $load->fresh()->toCustomerPayload($includeChildren),
        ]);
    }
}

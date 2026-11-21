<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\UpdateLoadRequest;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class UpdateLoadController extends Controller
{
    public function __invoke(UpdateLoadRequest $request, Load $load): JsonResponse
    {
        if ($load->type === LoadType::Direct) {
            $parties = $request->resolvedPartyIds();
            $load->fill([
                'customer_company_id' => $parties['customer_company_id'],
                'provider_company_id' => $parties['provider_company_id'],
                'collection_address_id' => $request->integer('collection_address_id'),
                'delivery_address_id' => $request->integer('delivery_address_id'),
                'pallet_count' => $request->integer('pallet_count'),
            ]);
        } elseif ($load->type === LoadType::AddDrop) {
            $load->fill([
                'delivery_address_id' => $request->integer('delivery_address_id'),
                'pallet_count' => $request->integer('pallet_count'),
            ]);
        } else {
            $load->fill([
                'delivery_address_id' => $request->integer('delivery_address_id'),
                'xdock_address_id' => $request->integer('xdock_address_id'),
                'secondary_provider_company_id' => $request->integer('secondary_provider_company_id'),
                'pallet_count' => $request->integer('pallet_count'),
            ]);
        }

        $load->save();

        $includeChildren = $load->type === LoadType::Direct;

        return response()->json([
            'load' => $load->fresh()->toCustomerPayload($includeChildren),
        ]);
    }
}

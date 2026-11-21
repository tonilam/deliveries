<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\MoveItemToChildLoadRequest;
use App\Models\Item;
use App\Models\Load;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MoveItemToChildLoadController extends Controller
{
    public function __invoke(MoveItemToChildLoadRequest $request, Load $load, Item $item): JsonResponse
    {
        $child = DB::transaction(function () use ($request, $load, $item): Load {
            if ($request->filled('child_load_id')) {
                $child = Load::query()
                    ->where('parent_load_id', $load->id)
                    ->whereKey($request->integer('child_load_id'))
                    ->firstOrFail();
            } else {
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
                ]);
            }

            $item->load_id = $child->id;
            $item->save();

            return $child;
        });

        $item->load('goodType');

        return response()->json([
            'item' => $item->toCustomerPayload(),
            'child_load' => $child->fresh()->toCustomerPayload(false),
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManageAddressRequest;
use App\Models\Address;
use Illuminate\Http\JsonResponse;

class ShowAddressController extends Controller
{
    public function __invoke(ManageAddressRequest $request, Address $address): JsonResponse
    {
        $address->load('zone');

        return response()->json([
            'address' => $address->toCustomerPayload(),
        ]);
    }
}

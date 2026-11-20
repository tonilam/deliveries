<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManageAddressRequest;
use App\Models\Address;
use Illuminate\Http\Response;

class DeleteAddressController extends Controller
{
    public function __invoke(ManageAddressRequest $request, Address $address): Response
    {
        $address->delete();

        return response()->noContent();
    }
}

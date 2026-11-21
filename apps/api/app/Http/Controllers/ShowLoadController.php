<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\ManageLoadRequest;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class ShowLoadController extends Controller
{
    public function __invoke(ManageLoadRequest $request, Load $load): JsonResponse
    {
        $load->loadMissing('company:id,company_type');

        return response()->json([
            'load' => $load->toCustomerPayload($load->type === LoadType::Direct),
            'own_company_type' => $load->company?->company_type?->value,
        ]);
    }
}

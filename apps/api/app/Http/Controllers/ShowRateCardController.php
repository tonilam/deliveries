<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManageRateCardRequest;
use App\Models\RateCard;
use Illuminate\Http\JsonResponse;

class ShowRateCardController extends Controller
{
    public function __invoke(ManageRateCardRequest $request, RateCard $rateCard): JsonResponse
    {
        return response()->json([
            'rate_card' => $rateCard->toCustomerPayload(),
        ]);
    }
}

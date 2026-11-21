<?php

namespace App\Http\Controllers;

use App\Actions\SyncRateCardRelations;
use App\Http\Requests\StoreRateCardRequest;
use App\Models\RateCard;
use Illuminate\Http\JsonResponse;

class CreateRateCardController extends Controller
{
    public function __invoke(StoreRateCardRequest $request, SyncRateCardRelations $sync): JsonResponse
    {
        $rateCard = RateCard::query()->create([
            'company_id' => $request->user()->company_id,
            'profile_name' => $request->string('profile_name')->toString(),
            'user_type' => $request->userType(),
            'minimum_price' => $request->input('minimum_price'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        $sync(
            $rateCard,
            $request->normalizedCompanyIds(),
            $request->normalizedZoneRates(),
        );

        $rateCard->refresh();

        return response()->json([
            'rate_card' => $rateCard->toCustomerPayload(),
        ], 201);
    }
}

<?php

namespace App\Actions;

use App\Models\RateCard;
use App\Models\RateCardZone;
use Illuminate\Support\Facades\DB;

class SyncRateCardRelations
{
    /**
     * @param  list<int>  $companyIds
     * @param  list<array{collection_zone_id: int, delivery_zone_id: int, base_rate: string, fuel_surcharge_percent: string}>  $zoneRates
     */
    public function __invoke(RateCard $rateCard, array $companyIds, array $zoneRates): void
    {
        DB::transaction(function () use ($rateCard, $companyIds, $zoneRates): void {
            $rateCard->restrictedCompanies()->sync($companyIds);

            $rateCard->zoneRates()->delete();

            foreach ($zoneRates as $row) {
                RateCardZone::query()->create([
                    'rate_card_id' => $rateCard->id,
                    'collection_zone_id' => $row['collection_zone_id'],
                    'delivery_zone_id' => $row['delivery_zone_id'],
                    'base_rate' => $row['base_rate'],
                    'fuel_surcharge_percent' => $row['fuel_surcharge_percent'],
                ]);
            }
        });
    }
}

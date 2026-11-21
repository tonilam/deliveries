<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'rate_card_id',
    'collection_zone_id',
    'delivery_zone_id',
    'base_rate',
    'fuel_surcharge_percent',
])]
class RateCardZone extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'base_rate' => 'decimal:2',
            'fuel_surcharge_percent' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<RateCard, $this>
     */
    public function rateCard(): BelongsTo
    {
        return $this->belongsTo(RateCard::class);
    }

    /**
     * @return BelongsTo<Zone, $this>
     */
    public function collectionZone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'collection_zone_id')->withTrashed();
    }

    /**
     * @return BelongsTo<Zone, $this>
     */
    public function deliveryZone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'delivery_zone_id')->withTrashed();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCustomerPayload(): array
    {
        $this->loadMissing(['collectionZone', 'deliveryZone']);

        return [
            'collection_zone_id' => $this->collection_zone_id,
            'collection_zone' => $this->collectionZone?->name ?? '',
            'delivery_zone_id' => $this->delivery_zone_id,
            'delivery_zone' => $this->deliveryZone?->name ?? '',
            'base_rate' => $this->base_rate,
            'fuel_surcharge_percent' => $this->fuel_surcharge_percent,
        ];
    }
}

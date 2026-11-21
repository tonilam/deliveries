<?php

namespace App\Models;

use App\Enums\ItemDisplayUnit;
use Database\Factories\ItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id',
    'good_type_code',
    'weight_tonnes',
    'display_unit',
    'order_number',
    'connote',
])]
class Item extends Model
{
    /** @use HasFactory<ItemFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'weight_tonnes' => 'decimal:6',
            'display_unit' => ItemDisplayUnit::class,
        ];
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<GoodType, $this>
     */
    public function goodType(): BelongsTo
    {
        return $this->belongsTo(GoodType::class, 'good_type_code', 'code')->withTrashed();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCustomerPayload(): array
    {
        $this->loadMissing('goodType');

        return [
            'id' => $this->id,
            'good_type_code' => $this->good_type_code,
            'good_type' => $this->goodType?->name ?? '',
            'weight_tonnes' => (string) $this->weight_tonnes,
            'display_unit' => $this->display_unit->value,
            'order_number' => $this->order_number,
            'connote' => $this->connote,
        ];
    }
}

<?php

namespace App\Models;

use App\Enums\AddressType;
use Database\Factories\AddressFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['company_id', 'type', 'business_name', 'address', 'zone_id', 'state', 'postcode'])]
class Address extends Model
{
    /** @use HasFactory<AddressFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => AddressType::class,
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
     * @return BelongsTo<Zone, $this>
     */
    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class)->withTrashed();
    }

    /**
     * @return array{id: int, type: string, business_name: string, address: string, zone_id: int, zone: string, state: string, postcode: string}
     */
    public function toCustomerPayload(): array
    {
        $this->loadMissing('zone');

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'business_name' => $this->business_name,
            'address' => $this->address,
            'zone_id' => $this->zone_id,
            'zone' => $this->zone?->name ?? '',
            'state' => $this->state,
            'postcode' => $this->postcode,
        ];
    }
}

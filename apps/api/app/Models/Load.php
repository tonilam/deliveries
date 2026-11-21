<?php

namespace App\Models;

use App\Enums\LoadType;
use Database\Factories\LoadFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'company_id',
    'parent_load_id',
    'type',
    'customer_company_id',
    'provider_company_id',
    'secondary_provider_company_id',
    'collection_address_id',
    'delivery_address_id',
    'xdock_address_id',
    'pallet_count',
])]
class Load extends Model
{
    /** @use HasFactory<LoadFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'type' => LoadType::class,
            'pallet_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Load $load): void {
            $loadIds = [$load->id];
            if ($load->type === LoadType::Direct) {
                $loadIds = array_merge(
                    $loadIds,
                    $load->children()->pluck('id')->all(),
                );
            }

            Item::query()->whereIn('load_id', $loadIds)->update(['load_id' => null]);
        });
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Load, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Load::class, 'parent_load_id');
    }

    /**
     * @return HasMany<Load, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Load::class, 'parent_load_id');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function customerCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'customer_company_id');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function providerCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'provider_company_id');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function secondaryProviderCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'secondary_provider_company_id');
    }

    /**
     * @return BelongsTo<Address, $this>
     */
    public function collectionAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'collection_address_id');
    }

    /**
     * @return BelongsTo<Address, $this>
     */
    public function deliveryAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'delivery_address_id');
    }

    /**
     * @return BelongsTo<Address, $this>
     */
    public function xdockAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'xdock_address_id');
    }

    /**
     * @return HasMany<Item, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(Item::class);
    }

    public function loadRelationPayload(): void
    {
        $this->loadMissing([
            'customerCompany:id,business_name',
            'providerCompany:id,business_name',
            'secondaryProviderCompany:id,business_name',
            'collectionAddress',
            'deliveryAddress',
            'xdockAddress',
        ]);
        $this->loadCount('items');
    }

    /**
     * @return array<string, mixed>
     */
    public function toCustomerPayload(bool $includeChildren = false): array
    {
        $this->loadRelationPayload();

        $payload = [
            'id' => $this->id,
            'parent_load_id' => $this->parent_load_id,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'customer_company_id' => $this->customer_company_id,
            'customer' => $this->customerCompany?->business_name ?? '',
            'provider_company_id' => $this->provider_company_id,
            'provider' => $this->providerCompany?->business_name ?? '',
            'secondary_provider_company_id' => $this->secondary_provider_company_id,
            'secondary_provider' => $this->secondaryProviderCompany?->business_name,
            'collection_address_id' => $this->collection_address_id,
            'collection' => $this->formatAddressLabel($this->collectionAddress),
            'delivery_address_id' => $this->delivery_address_id,
            'delivery' => $this->formatAddressLabel($this->deliveryAddress),
            'xdock_address_id' => $this->xdock_address_id,
            'xdock' => $this->formatAddressLabel($this->xdockAddress),
            'pallet_count' => $this->pallet_count,
            'item_count' => (int) ($this->items_count ?? $this->items()->count()),
        ];

        if ($includeChildren && $this->type === LoadType::Direct) {
            $this->loadMissing([
                'children.customerCompany:id,business_name',
                'children.providerCompany:id,business_name',
                'children.secondaryProviderCompany:id,business_name',
                'children.collectionAddress',
                'children.deliveryAddress',
                'children.xdockAddress',
            ]);
            $this->children->loadCount('items');

            $payload['children'] = $this->children
                ->map(static fn (Load $child) => $child->toCustomerPayload(false))
                ->values()
                ->all();
        }

        return $payload;
    }

    private function formatAddressLabel(?Address $address): ?string
    {
        if ($address === null) {
            return null;
        }

        return trim($address->business_name.' — '.$address->address);
    }
}

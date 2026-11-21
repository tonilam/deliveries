<?php

namespace App\Models;

use App\Enums\RateCardUserType;
use Database\Factories\RateCardFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'company_id',
    'profile_name',
    'user_type',
    'minimum_price',
    'is_active',
])]
class RateCard extends Model
{
    /** @use HasFactory<RateCardFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_type' => RateCardUserType::class,
            'minimum_price' => 'decimal:2',
            'is_active' => 'boolean',
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
     * @return BelongsToMany<Company, $this>
     */
    public function restrictedCompanies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'rate_card_companies');
    }

    /**
     * @return HasMany<RateCardZone, $this>
     */
    public function zoneRates(): HasMany
    {
        return $this->hasMany(RateCardZone::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toListPayload(): array
    {
        $this->loadMissing([
            'restrictedCompanies' => static fn ($query) => $query
                ->select('companies.id', 'companies.business_name')
                ->orderBy('companies.business_name'),
        ]);

        return [
            'id' => $this->id,
            'profile_name' => $this->profile_name,
            'user_type' => $this->user_type->value,
            'is_active' => $this->is_active,
            'linked_companies' => $this->restrictedCompanies
                ->pluck('business_name')
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toCustomerPayload(): array
    {
        $this->loadMissing([
            'restrictedCompanies' => static fn ($query) => $query->select('companies.id', 'companies.business_name'),
            'zoneRates.collectionZone',
            'zoneRates.deliveryZone',
        ]);

        $companies = $this->restrictedCompanies
            ->map(static fn (Company $company) => [
                'id' => $company->id,
                'business_name' => $company->business_name,
            ])
            ->values()
            ->all();

        $customerCompanies = $this->user_type === RateCardUserType::Customer ? $companies : [];
        $providerCompanies = $this->user_type === RateCardUserType::Provider ? $companies : [];

        return [
            'id' => $this->id,
            'profile_name' => $this->profile_name,
            'user_type' => $this->user_type->value,
            'minimum_price' => $this->minimum_price,
            'is_active' => $this->is_active,
            'customer_company_ids' => array_column($customerCompanies, 'id'),
            'provider_company_ids' => array_column($providerCompanies, 'id'),
            'customer_companies' => $customerCompanies,
            'provider_companies' => $providerCompanies,
            'zone_rates' => $this->zoneRates
                ->map(static fn (RateCardZone $row) => $row->toCustomerPayload())
                ->values()
                ->all(),
        ];
    }
}

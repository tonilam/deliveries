<?php

namespace App\Models;

use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'country_id',
    'reg_number',
    'reg_type',
    'business_name',
    'invoicee_name',
    'gst_rate',
    'tracking_option',
    'phone',
    'email',
    'address',
    'allowed_domains',
])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'allowed_domains' => 'array',
            'gst_rate' => 'float',
        ];
    }

    /**
     * @return BelongsTo<Country, $this>
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<Address, $this>
     */
    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    /**
     * @return HasMany<CompanyAllowedDomain, $this>
     */
    public function allowedDomainRows(): HasMany
    {
        return $this->hasMany(CompanyAllowedDomain::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminPayload(): array
    {
        $this->loadMissing(['country' => static fn ($query) => $query->select('id', 'name', 'code')]);

        if (! array_key_exists('addresses_count', $this->getAttributes()) && ! isset($this->addresses_count)) {
            $this->loadCount('addresses');
        }

        return [
            'id' => $this->id,
            'country_id' => $this->country_id,
            'country' => $this->country === null ? null : [
                'id' => $this->country->id,
                'name' => $this->country->name,
                'code' => $this->country->code,
            ],
            'has_addresses' => (int) $this->addresses_count > 0,
            'reg_number' => $this->reg_number,
            'reg_type' => $this->reg_type,
            'business_name' => $this->business_name,
            'invoicee_name' => $this->invoicee_name,
            'gst_rate' => $this->gst_rate,
            'tracking_option' => $this->tracking_option,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'allowed_domains' => $this->allowed_domains ?? [],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

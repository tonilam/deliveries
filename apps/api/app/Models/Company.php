<?php

namespace App\Models;

use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
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
}

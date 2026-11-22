<?php

namespace App\Models;

use Database\Factories\VehicleCategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'name',
    'code',
    'sort_order',
])]
class VehicleCategory extends Model
{
    /** @use HasFactory<VehicleCategoryFactory> */
    use HasFactory;

    use SoftDeletes;

    /**
     * @return HasMany<VehicleBodyType, $this>
     */
    public function bodyTypes(): HasMany
    {
        return $this->hasMany(VehicleBodyType::class);
    }

    /**
     * @param  array<int, true>  $activeBodyTypeIds
     * @return array<string, mixed>
     */
    public function toCustomerCataloguePayload(array $activeBodyTypeIds): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'sort_order' => $this->sort_order,
            'body_types' => $this->relationLoaded('bodyTypes')
                ? $this->bodyTypes
                    ->map(static fn (VehicleBodyType $bodyType) => $bodyType->toCustomerPayload(
                        isset($activeBodyTypeIds[$bodyType->id]),
                    ))
                    ->values()
                    ->all()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminPayload(bool $withBodyTypes = false): array
    {
        $payload = [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'sort_order' => $this->sort_order,
            'body_types_count' => $this->body_types_count ?? $this->bodyTypes()->count(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($withBodyTypes) {
            $payload['body_types'] = $this->relationLoaded('bodyTypes')
                ? $this->bodyTypes
                    ->map(static fn (VehicleBodyType $bodyType) => $bodyType->toAdminPayload())
                    ->values()
                    ->all()
                : [];
        }

        return $payload;
    }
}

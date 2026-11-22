<?php

namespace App\Models;

use App\Enums\VehicleBodyTypeCapacityUnit;
use Database\Factories\VehicleBodyTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'vehicle_category_id',
    'name',
    'code',
    'capacity',
    'capacity_unit',
    'pallet_spaces',
    'cubic_metres',
    'payload_kg',
    'description',
    'option_values',
])]
class VehicleBodyType extends Model
{
    /** @use HasFactory<VehicleBodyTypeFactory> */
    use HasFactory;

    use SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'capacity' => 'decimal:3',
            'cubic_metres' => 'decimal:2',
            'capacity_unit' => VehicleBodyTypeCapacityUnit::class,
            'option_values' => 'array',
        ];
    }

    /**
     * @return BelongsTo<VehicleCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(VehicleCategory::class, 'vehicle_category_id');
    }

    /**
     * @return HasMany<VehicleBodyTypeOption, $this>
     */
    public function options(): HasMany
    {
        return $this->hasMany(VehicleBodyTypeOption::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @return BelongsToMany<Company, $this>
     */
    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'company_vehicle_body_types')
            ->withTimestamps();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCustomerPayload(bool $active): array
    {
        return [
            'id' => $this->id,
            'vehicle_category_id' => $this->vehicle_category_id,
            'name' => $this->name,
            'code' => $this->code,
            'capacity' => $this->capacity,
            'capacity_unit' => $this->capacity_unit instanceof VehicleBodyTypeCapacityUnit
                ? $this->capacity_unit->value
                : $this->capacity_unit,
            'pallet_spaces' => $this->pallet_spaces,
            'cubic_metres' => $this->cubic_metres,
            'payload_kg' => $this->payload_kg,
            'description' => $this->description,
            'active' => $active,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toOptionPayload(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'vehicle_category_id' => $this->vehicle_category_id,
            'category_name' => $this->relationLoaded('category') ? $this->category?->name : null,
            'capacity' => $this->capacity,
            'capacity_unit' => $this->capacity_unit instanceof VehicleBodyTypeCapacityUnit
                ? $this->capacity_unit->value
                : $this->capacity_unit,
            'options' => $this->relationLoaded('options')
                ? $this->options
                    ->map(static fn (VehicleBodyTypeOption $option) => $option->toCustomerOptionDefinition())
                    ->values()
                    ->all()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminPayload(bool $includeOptions = false): array
    {
        $payload = [
            'id' => $this->id,
            'vehicle_category_id' => $this->vehicle_category_id,
            'name' => $this->name,
            'code' => $this->code,
            'capacity' => $this->capacity,
            'capacity_unit' => $this->capacity_unit instanceof VehicleBodyTypeCapacityUnit
                ? $this->capacity_unit->value
                : $this->capacity_unit,
            'pallet_spaces' => $this->pallet_spaces,
            'cubic_metres' => $this->cubic_metres,
            'payload_kg' => $this->payload_kg,
            'description' => $this->description,
            'option_values' => $this->option_values ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($includeOptions) {
            $payload['options'] = $this->relationLoaded('options')
                ? $this->options->map(static fn (VehicleBodyTypeOption $opt) => $opt->toAdminPayload())->values()->all()
                : $this->options()->get()->map(static fn (VehicleBodyTypeOption $opt) => $opt->toAdminPayload())->values()->all();
        }

        return $payload;
    }
}

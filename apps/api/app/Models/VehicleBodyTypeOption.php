<?php

namespace App\Models;

use App\Enums\VehicleBodyTypeOptionDataType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use Database\Factories\VehicleBodyTypeOptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'vehicle_body_type_id',
    'key',
    'label',
    'data_type',
    'visibility',
    'required',
    'sort_order',
])]
class VehicleBodyTypeOption extends Model
{
    /** @use HasFactory<VehicleBodyTypeOptionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data_type' => VehicleBodyTypeOptionDataType::class,
            'visibility' => VehicleBodyTypeOptionVisibility::class,
            'required' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<VehicleBodyType, $this>
     */
    public function bodyType(): BelongsTo
    {
        return $this->belongsTo(VehicleBodyType::class, 'vehicle_body_type_id');
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @return array<string, mixed>
     */
    public function toCustomerOptionDefinition(): array
    {
        return [
            'key' => $this->key,
            'label' => $this->label,
            'data_type' => $this->data_type instanceof VehicleBodyTypeOptionDataType
                ? $this->data_type->value
                : $this->data_type,
            'required' => $this->required,
            'sort_order' => $this->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminPayload(): array
    {
        return [
            'id' => $this->id,
            'vehicle_body_type_id' => $this->vehicle_body_type_id,
            'key' => $this->key,
            'label' => $this->label,
            'data_type' => $this->data_type instanceof VehicleBodyTypeOptionDataType
                ? $this->data_type->value
                : $this->data_type,
            'visibility' => $this->visibility instanceof VehicleBodyTypeOptionVisibility
                ? $this->visibility->value
                : $this->visibility,
            'required' => $this->required,
            'sort_order' => $this->sort_order,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

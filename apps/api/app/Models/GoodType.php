<?php

namespace App\Models;

use Database\Factories\GoodTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'code',
    'name',
    'refrigerated_required',
])]
class GoodType extends Model
{
    /** @use HasFactory<GoodTypeFactory> */
    use HasFactory;

    use SoftDeletes;

    public $incrementing = false;

    protected $primaryKey = 'code';

    protected $keyType = 'string';

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    protected function casts(): array
    {
        return [
            'refrigerated_required' => 'boolean',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminPayload(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'refrigerated_required' => $this->refrigerated_required,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

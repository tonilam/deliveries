<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Enums\VehicleBodyTypeCapacityUnit;
use App\Models\VehicleBodyType;
use App\Models\VehicleCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVehicleBodyTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code') && is_string($this->input('code'))) {
            $this->merge(['code' => trim($this->input('code'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var VehicleCategory $category */
        $category = $this->route('vehicleCategory');
        /** @var VehicleBodyType $bodyType */
        $bodyType = $this->route('bodyType');

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:64',
                Rule::unique('vehicle_body_types', 'code')
                    ->where('vehicle_category_id', $category->id)
                    ->ignore($bodyType->id),
            ],
            'capacity' => ['required', 'numeric', 'min:0'],
            'capacity_unit' => ['required', 'string', Rule::enum(VehicleBodyTypeCapacityUnit::class)],
            'pallet_spaces' => ['nullable', 'integer', 'min:0', 'max:999'],
            'cubic_metres' => ['nullable', 'numeric', 'min:0'],
            'payload_kg' => ['nullable', 'integer', 'min:0'],
            'description' => ['nullable', 'string', 'max:5000'],
            'option_values' => ['sometimes', 'nullable', 'array'],
        ];
    }
}

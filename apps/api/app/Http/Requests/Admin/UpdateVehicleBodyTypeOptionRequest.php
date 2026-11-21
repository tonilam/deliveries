<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Enums\VehicleBodyTypeOptionDataType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVehicleBodyTypeOptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var VehicleBodyType $bodyType */
        $bodyType = $this->route('bodyType');
        /** @var VehicleBodyTypeOption $option */
        $option = $this->route('option');

        return [
            'key' => [
                'required',
                'string',
                'max:64',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('vehicle_body_type_options', 'key')
                    ->where('vehicle_body_type_id', $bodyType->id)
                    ->ignore($option->id),
            ],
            'label' => ['required', 'string', 'max:255'],
            'data_type' => ['required', 'string', Rule::enum(VehicleBodyTypeOptionDataType::class)],
            'visibility' => ['required', 'string', Rule::enum(VehicleBodyTypeOptionVisibility::class)],
            'required' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:9999'],
        ];
    }
}

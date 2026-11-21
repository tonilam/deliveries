<?php

namespace App\Http\Requests;

use App\Enums\ItemDisplayUnit;
use App\Models\Item;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Item::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'good_type_code' => [
                'required',
                'string',
                'max:8',
                Rule::exists('good_types', 'code')->whereNull('deleted_at'),
            ],
            'weight_tonnes' => ['required', 'numeric', 'gt:0'],
            'display_unit' => ['required', 'string', Rule::enum(ItemDisplayUnit::class)],
            'order_number' => ['nullable', 'string', 'max:255'],
            'connote' => ['nullable', 'string', 'max:255'],
        ];
    }
}

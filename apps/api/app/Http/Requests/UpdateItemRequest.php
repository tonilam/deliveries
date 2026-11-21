<?php

namespace App\Http\Requests;

use App\Models\Item;
use Illuminate\Validation\Rule;

class UpdateItemRequest extends StoreItemRequest
{
    public function authorize(): bool
    {
        $item = $this->route('item');

        return $item instanceof Item
            && ($this->user()?->can('update', $item) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $item = $this->route('item');
        if (! $item instanceof Item) {
            return $rules;
        }

        $code = $this->input('good_type_code');
        if (is_string($code) && $code === $item->good_type_code) {
            $rules['good_type_code'] = ['required', 'string', 'max:8', Rule::in([$item->good_type_code])];
        }

        return $rules;
    }
}

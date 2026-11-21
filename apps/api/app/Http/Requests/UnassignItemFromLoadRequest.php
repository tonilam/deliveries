<?php

namespace App\Http\Requests;

use App\Models\Item;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UnassignItemFromLoadRequest extends FormRequest
{
    public function authorize(): bool
    {
        $load = $this->route('load');
        $item = $this->route('item');

        if (! $load instanceof Load || ! $item instanceof Item) {
            return false;
        }

        if (! ($this->user()?->can('update', $load) ?? false)) {
            return false;
        }

        return (int) $item->company_id === (int) $this->user()?->company_id
            && (int) $item->load_id === (int) $load->id;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $load = $this->route('load');
            $item = $this->route('item');
            if (! $load instanceof Load || ! $item instanceof Item) {
                return;
            }

            if ((int) $item->load_id !== (int) $load->id) {
                $validator->errors()->add('item_id', 'This item is not assigned to this load.');
            }
        });
    }
}

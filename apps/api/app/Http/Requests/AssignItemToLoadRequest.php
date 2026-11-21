<?php

namespace App\Http\Requests;

use App\Models\Item;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssignItemToLoadRequest extends FormRequest
{
    public function authorize(): bool
    {
        $load = $this->route('load');

        return $load instanceof Load && ($this->user()?->can('update', $load) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        return [
            'item_id' => [
                'required',
                'integer',
                Rule::exists('items', 'id')->where(
                    static fn ($query) => $query
                        ->where('company_id', $companyId)
                        ->whereNull('load_id'),
                ),
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $itemId = $this->integer('item_id');
            if ($itemId <= 0) {
                return;
            }

            $assigned = Item::query()->whereKey($itemId)->value('load_id');
            if ($assigned !== null) {
                $validator->errors()->add('item_id', 'This item is already assigned to a load.');
            }
        });
    }
}

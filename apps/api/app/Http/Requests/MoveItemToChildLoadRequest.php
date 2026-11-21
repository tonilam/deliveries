<?php

namespace App\Http\Requests;

use App\Enums\LoadType;
use App\Http\Requests\Concerns\ValidatesLoadPayload;
use App\Models\Item;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class MoveItemToChildLoadRequest extends FormRequest
{
    use ValidatesLoadPayload;

    public function authorize(): bool
    {
        $load = $this->route('load');
        $item = $this->route('item');

        if (! $load instanceof Load || ! $item instanceof Item) {
            return false;
        }

        if ($load->type !== LoadType::Direct) {
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
        if ($this->filled('child_load_id')) {
            $parent = $this->route('load');
            $companyId = $this->user()?->company_id;

            return [
                'child_load_id' => [
                    'required',
                    'integer',
                    Rule::exists('loads', 'id')->where(
                        static function ($query) use ($parent, $companyId): void {
                            $query
                                ->where('company_id', $companyId)
                                ->where('parent_load_id', $parent instanceof Load ? $parent->id : null);
                        },
                    ),
                ],
            ];
        }

        $typeValue = $this->input('type', LoadType::AddDrop->value);
        $childType = is_string($typeValue) ? LoadType::tryFrom($typeValue) : LoadType::AddDrop;
        if ($childType === null) {
            $childType = LoadType::AddDrop;
        }

        return $this->childLoadFieldRules($childType);
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

        if ($this->filled('child_load_id')) {
            return;
        }

        $parent = $this->route('load');
        if ($parent instanceof Load) {
            $this->withChildLoadValidator($validator, $parent);
        }
    }
}

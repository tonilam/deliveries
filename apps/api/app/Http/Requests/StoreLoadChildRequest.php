<?php

namespace App\Http\Requests;

use App\Enums\LoadType;
use App\Http\Requests\Concerns\ValidatesLoadPayload;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreLoadChildRequest extends FormRequest
{
    use ValidatesLoadPayload;

    public function authorize(): bool
    {
        $parent = $this->route('load');

        return $parent instanceof Load && ($this->user()?->can('update', $parent) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $typeValue = $this->input('type', LoadType::AddDrop->value);
        $childType = is_string($typeValue) ? LoadType::tryFrom($typeValue) : LoadType::AddDrop;
        if ($childType === null) {
            $childType = LoadType::AddDrop;
        }

        return $this->childLoadFieldRules($childType);
    }

    public function withValidator(Validator $validator): void
    {
        $parent = $this->route('load');
        if ($parent instanceof Load) {
            $this->withChildLoadValidator($validator, $parent);
        }
    }
}

<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesLoadPayload;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreLoadRequest extends FormRequest
{
    use ValidatesLoadPayload;

    public function authorize(): bool
    {
        return $this->user()?->can('create', Load::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return $this->directLoadFieldRules();
    }

    public function withValidator(Validator $validator): void
    {
        $this->withDirectLoadValidator($validator);
    }
}

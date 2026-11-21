<?php

namespace App\Http\Requests;

use App\Models\Item;
use Illuminate\Foundation\Http\FormRequest;

class ManageItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        $item = $this->route('item');
        if (! $item instanceof Item) {
            return false;
        }

        $ability = $this->isMethod('DELETE') ? 'delete' : 'view';

        return $this->user()?->can($ability, $item) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

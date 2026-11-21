<?php

namespace App\Http\Requests;

use App\Models\Address;
use Illuminate\Foundation\Http\FormRequest;

class ManageAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        $address = $this->route('address');
        if (! $address instanceof Address) {
            return false;
        }

        $ability = $this->isMethod('DELETE') ? 'delete' : 'view';

        return $this->user()?->can($ability, $address) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

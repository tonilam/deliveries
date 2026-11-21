<?php

namespace App\Http\Requests;

use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;

class ManageLoadRequest extends FormRequest
{
    public function authorize(): bool
    {
        $load = $this->route('load');
        if (! $load instanceof Load) {
            return false;
        }

        $ability = $this->isMethod('DELETE') ? 'delete' : 'view';

        return $this->user()?->can($ability, $load) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

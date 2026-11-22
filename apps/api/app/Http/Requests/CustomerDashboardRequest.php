<?php

namespace App\Http\Requests;

use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;

class CustomerDashboardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Load::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}

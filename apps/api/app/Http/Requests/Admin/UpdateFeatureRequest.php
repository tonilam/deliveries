<?php

namespace App\Http\Requests\Admin;

use App\Enums\FeatureKey;
use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateFeatureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Admin;
    }

    protected function prepareForValidation(): void
    {
        $key = $this->route('key');
        if (FeatureKey::tryFrom((string) $key) === null) {
            throw new NotFoundHttpException('Unknown feature.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
        ];
    }

    public function featureKey(): string
    {
        return (string) $this->route('key');
    }
}

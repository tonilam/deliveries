<?php

namespace App\Services;

use App\Enums\VehicleBodyTypeOptionDataType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Models\VehicleBodyType;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class VehicleBodyTypeOptionValuesValidator
{
    /**
     * @param  array<string, mixed>|null  $optionValues
     * @return array<string, mixed>
     */
    public function validateAndNormalize(
        VehicleBodyType $bodyType,
        ?array $optionValues,
        string $errorKeyPrefix = 'option_values',
        bool $publicOnly = false,
    ): array {
        $definitions = $bodyType->relationLoaded('options')
            ? $bodyType->options
            : $bodyType->options()->get();

        if ($publicOnly) {
            $definitions = $definitions->filter(
                static fn ($definition) => $definition->visibility === VehicleBodyTypeOptionVisibility::Public,
            );
        }

        $values = $optionValues ?? [];
        $normalized = [];
        $errors = [];

        /** @var Collection<int, string> $allowedKeys */
        $allowedKeys = $definitions->pluck('key');

        foreach ($values as $key => $value) {
            if (! is_string($key)) {
                continue;
            }
            if (! $allowedKeys->contains($key)) {
                $errors["{$errorKeyPrefix}.{$key}"] = ['Unknown option key.'];

                continue;
            }

            $definition = $definitions->firstWhere('key', $key);
            if ($definition === null) {
                continue;
            }

            try {
                $normalized[$key] = $this->castValue($definition->data_type, $value);
            } catch (\InvalidArgumentException) {
                $errors["{$errorKeyPrefix}.{$key}"] = ['Invalid value for this option type.'];
            }
        }

        foreach ($definitions as $definition) {
            if (! $definition->required) {
                continue;
            }
            if (! array_key_exists($definition->key, $normalized)) {
                $errors["{$errorKeyPrefix}.{$definition->key}"] = ['This option is required.'];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $normalized;
    }

    private function castValue(VehicleBodyTypeOptionDataType $dataType, mixed $value): mixed
    {
        return match ($dataType) {
            VehicleBodyTypeOptionDataType::Boolean => filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
                ?? throw new \InvalidArgumentException,
            VehicleBodyTypeOptionDataType::Varchar => is_string($value) && trim($value) !== ''
                ? trim($value)
                : (is_scalar($value) && (string) $value !== ''
                    ? trim((string) $value)
                    : throw new \InvalidArgumentException),
        };
    }
}

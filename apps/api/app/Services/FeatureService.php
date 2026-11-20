<?php

namespace App\Services;

use App\Enums\FeatureKey;
use App\Models\Feature;
use InvalidArgumentException;

class FeatureService
{
    public function isEnabled(FeatureKey $key): bool
    {
        $feature = Feature::query()->where('key', $key->value)->first();

        return $feature?->enabled ?? true;
    }

    /**
     * @return list<array{key: string, name: string, description: string, enabled: bool}>
     */
    public function listForAdmin(): array
    {
        $rows = Feature::query()->get()->keyBy('key');

        return array_map(
            function (FeatureKey $key) use ($rows): array {
                $row = $rows->get($key->value);

                return [
                    'key' => $key->value,
                    'name' => $key->name(),
                    'description' => $key->description(),
                    'enabled' => $row?->enabled ?? true,
                ];
            },
            FeatureKey::cases(),
        );
    }

    /**
     * @return array<string, bool>
     */
    public function publicFlags(): array
    {
        $flags = [];

        foreach (FeatureKey::cases() as $key) {
            $flags[$key->value] = $this->isEnabled($key);
        }

        return $flags;
    }

    /**
     * @return array{key: string, name: string, description: string, enabled: bool}
     */
    public function setEnabled(string $key, bool $enabled): array
    {
        $featureKey = FeatureKey::tryFrom($key);

        if ($featureKey === null) {
            throw new InvalidArgumentException('Unknown feature key.');
        }

        $feature = Feature::query()->updateOrCreate(
            ['key' => $featureKey->value],
            ['enabled' => $enabled],
        );

        return [
            'key' => $featureKey->value,
            'name' => $featureKey->name(),
            'description' => $featureKey->description(),
            'enabled' => $feature->enabled,
        ];
    }
}

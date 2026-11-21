<?php

namespace App\Http\Requests\Concerns;

use App\Enums\RateCardUserType;
use App\Models\Company;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

trait ValidatesRateCardPayload
{
    /**
     * @return array<string, mixed>
     */
    protected function rateCardFieldRules(?int $rateCardId = null): array
    {
        $companyId = $this->user()?->company_id;
        $countryId = $this->companyCountryId();

        $profileUnique = Rule::unique('rate_cards', 'profile_name');
        if ($companyId !== null) {
            $profileUnique = $profileUnique->where('company_id', $companyId);
        }
        if ($rateCardId !== null) {
            $profileUnique = $profileUnique->ignore($rateCardId);
        }

        return [
            'profile_name' => ['required', 'string', 'max:255', $profileUnique],
            'user_type' => ['required', 'string', Rule::enum(RateCardUserType::class)],
            'minimum_price' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'company_ids' => ['sometimes', 'array'],
            'company_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('companies', 'id'),
                Rule::notIn(array_filter([$companyId])),
            ],
            'zone_rates' => ['required', 'array', 'min:1'],
            'zone_rates.*.collection_zone_id' => [
                'required',
                'integer',
                Rule::when(
                    $countryId !== null,
                    Rule::exists('zones', 'id')->where(fn ($query) => $query
                        ->where('country_id', $countryId)
                        ->where('is_active', true)),
                ),
            ],
            'zone_rates.*.delivery_zone_id' => [
                'required',
                'integer',
                Rule::when(
                    $countryId !== null,
                    Rule::exists('zones', 'id')->where(fn ($query) => $query
                        ->where('country_id', $countryId)
                        ->where('is_active', true)),
                ),
            ],
            'zone_rates.*.base_rate' => ['required', 'numeric', 'min:0'],
            'zone_rates.*.fuel_surcharge_percent' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function withRateCardValidator(Validator $validator, ?int $rateCardId = null): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->companyCountryId() === null) {
                $validator->errors()->add(
                    'zone_rates',
                    'Your company must have a country before rate cards can be saved.',
                );

                return;
            }

            $zones = $this->input('zone_rates', []);
            if (! is_array($zones)) {
                return;
            }

            $pairs = [];
            foreach ($zones as $index => $row) {
                if (! is_array($row)) {
                    continue;
                }
                $collection = $row['collection_zone_id'] ?? null;
                $delivery = $row['delivery_zone_id'] ?? null;
                if (! is_numeric($collection) || ! is_numeric($delivery)) {
                    continue;
                }
                $key = ((int) $collection).':'.((int) $delivery);
                if (isset($pairs[$key])) {
                    $validator->errors()->add(
                        "zone_rates.{$index}.collection_zone_id",
                        'Each collection and delivery zone pair must be unique on this rate card.',
                    );
                }
                $pairs[$key] = true;
            }
        });
    }

    private function companyCountryId(): ?int
    {
        $companyId = $this->user()?->company_id;
        if ($companyId === null) {
            return null;
        }

        $countryId = Company::query()->whereKey($companyId)->value('country_id');

        return is_numeric($countryId) ? (int) $countryId : null;
    }

    /**
     * @return list<int>
     */
    public function normalizedCompanyIds(): array
    {
        $raw = $this->input('company_ids', []);
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_unique(array_map('intval', array_filter($raw, is_numeric(...)))));
    }

    /**
     * @return list<array{collection_zone_id: int, delivery_zone_id: int, base_rate: string, fuel_surcharge_percent: string}>
     */
    public function normalizedZoneRates(): array
    {
        $raw = $this->input('zone_rates', []);
        if (! is_array($raw)) {
            return [];
        }

        $rows = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $rows[] = [
                'collection_zone_id' => (int) $row['collection_zone_id'],
                'delivery_zone_id' => (int) $row['delivery_zone_id'],
                'base_rate' => number_format((float) $row['base_rate'], 2, '.', ''),
                'fuel_surcharge_percent' => number_format((float) $row['fuel_surcharge_percent'], 2, '.', ''),
            ];
        }

        return $rows;
    }
}

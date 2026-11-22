<?php

namespace App\Http\Requests\Concerns;

use App\Enums\AddressType;
use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Models\Address;
use App\Models\Company;
use App\Models\Load;
use App\Models\VehicleBodyType;
use App\Services\VehicleBodyTypeOptionValuesValidator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

trait ValidatesLoadPayload
{
    /**
     * @return array<string, mixed>
     */
    protected function scheduleFieldRules(): array
    {
        return [
            'pickup_date' => ['required', 'date', 'date_format:Y-m-d'],
            'pickup_time' => ['required', 'date_format:H:i'],
            'dropoff_date' => ['required', 'date', 'date_format:Y-m-d'],
            'dropoff_time' => ['required', 'date_format:H:i'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function directLoadFieldRules(): array
    {
        $companyId = $this->user()?->company_id;
        $owner = $companyId !== null ? Company::query()->find($companyId) : null;

        $customerRule = ['nullable', 'integer', Rule::exists('companies', 'id')];
        $providerRule = ['nullable', 'integer', Rule::exists('companies', 'id')];

        if ($owner !== null) {
            if ($owner->company_type === CompanyType::Customer) {
                $customerRule = ['prohibited'];
                $providerRule = [
                    'required',
                    'integer',
                    Rule::exists('companies', 'id')->where(
                        static fn ($query) => $query
                            ->where('parent_company_id', $owner->id)
                            ->where('company_type', CompanyType::Provider->value),
                    ),
                ];
            } elseif ($owner->company_type === CompanyType::Provider) {
                $providerRule = ['prohibited'];
                $customerRule = [
                    'required',
                    'integer',
                    Rule::exists('companies', 'id')->where(
                        static fn ($query) => $query
                            ->where('parent_company_id', $owner->id)
                            ->where('company_type', CompanyType::Customer->value),
                    ),
                ];
            } else {
                $customerRule = [
                    'required',
                    'integer',
                    Rule::exists('companies', 'id')->where(
                        static fn ($query) => $query
                            ->where('parent_company_id', $owner->id)
                            ->where('company_type', CompanyType::Customer->value),
                    ),
                ];
                $providerRule = [
                    'required',
                    'integer',
                    Rule::exists('companies', 'id')->where(
                        static fn ($query) => $query
                            ->where('parent_company_id', $owner->id)
                            ->where('company_type', CompanyType::Provider->value),
                    ),
                ];
            }
        }

        $addressExists = Rule::exists('addresses', 'id')->where(
            static fn ($query) => $query->where('company_id', $companyId),
        );

        return array_merge(
            [
                'customer_company_id' => $customerRule,
                'provider_company_id' => $providerRule,
                'collection_address_id' => [
                    'required',
                    'integer',
                    $addressExists,
                ],
                'delivery_address_id' => [
                    'required',
                    'integer',
                    $addressExists,
                    'different:collection_address_id',
                ],
                'pallet_count' => ['required', 'integer', 'min:0'],
                'vehicle_body_type_id' => ['nullable', 'integer', Rule::exists('vehicle_body_types', 'id')],
                'vehicle_option_values' => ['nullable', 'array'],
            ],
            $this->scheduleFieldRules(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function childLoadFieldRules(LoadType $childType): array
    {
        $companyId = $this->user()?->company_id;
        $addressExists = Rule::exists('addresses', 'id')->where(
            static fn ($query) => $query->where('company_id', $companyId),
        );

        $rules = array_merge(
            [
                'type' => ['required', 'string', Rule::enum(LoadType::class), Rule::in(
                    array_map(static fn (LoadType $t) => $t->value, LoadType::childTypes()),
                )],
                'delivery_address_id' => [
                    'required',
                    'integer',
                    $addressExists,
                ],
                'pallet_count' => ['required', 'integer', 'min:0'],
            ],
            $this->scheduleFieldRules(),
            [
                'vehicle_body_type_id' => ['prohibited'],
                'vehicle_option_values' => ['prohibited'],
            ],
        );

        if ($childType === LoadType::XDock) {
            $owner = $companyId !== null ? Company::query()->find($companyId) : null;
            $secondaryRule = ['required', 'integer', Rule::exists('companies', 'id')];
            if ($owner !== null) {
                $secondaryRule = [
                    'required',
                    'integer',
                    Rule::exists('companies', 'id')->where(
                        static fn ($query) => $query
                            ->where('parent_company_id', $owner->id)
                            ->where('company_type', CompanyType::Provider->value),
                    ),
                ];
            }

            $rules['xdock_address_id'] = ['required', 'integer', $addressExists];
            $rules['secondary_provider_company_id'] = $secondaryRule;
        }

        return $rules;
    }

    public function withDirectLoadValidator(Validator $validator, ?Load $existing = null): void
    {
        $validator->after(function (Validator $validator) use ($existing): void {
            $companyId = $this->user()?->company_id;
            if ($companyId === null) {
                return;
            }

            $owner = Company::query()->find($companyId);
            if ($owner === null) {
                return;
            }

            $collectionId = $this->integer('collection_address_id');
            $deliveryId = $this->integer('delivery_address_id');

            $this->assertAddressType($validator, 'collection_address_id', $collectionId, AddressType::Collection, $companyId);
            $this->assertAddressType($validator, 'delivery_address_id', $deliveryId, AddressType::Delivery, $companyId);

            if ($owner->company_type === CompanyType::Customer) {
                // customer implicit from owner — nothing to check on customer_company_id
            } elseif ($owner->company_type === CompanyType::Provider) {
                // provider implicit
            } else {
                $customerId = $this->integer('customer_company_id');
                $providerId = $this->integer('provider_company_id');
                if ($customerId === $providerId) {
                    $validator->errors()->add('provider_company_id', 'Customer and provider must be different companies.');
                }
            }

            if ($existing !== null && $existing->type !== LoadType::Direct) {
                $validator->errors()->add('type', 'Only direct loads use this endpoint.');
            }

            $this->assertScheduleOrder($validator);
            $this->assertDirectTruckType($validator, $existing);
        });
    }

    public function withChildLoadValidator(Validator $validator, Load $parent): void
    {
        $validator->after(function (Validator $validator) use ($parent): void {
            $companyId = $this->user()?->company_id;
            if ($companyId === null) {
                return;
            }

            if ($parent->type !== LoadType::Direct) {
                $validator->errors()->add('parent_load_id', 'Child loads must belong to a direct load.');

                return;
            }

            if ((int) $parent->company_id !== (int) $companyId) {
                $validator->errors()->add('parent_load_id', 'Invalid parent load.');

                return;
            }

            $typeValue = $this->input('type');
            $childType = is_string($typeValue) ? LoadType::tryFrom($typeValue) : null;
            if ($childType === null) {
                return;
            }

            $owner = Company::query()->find($companyId);
            if ($childType === LoadType::XDock && $owner?->company_type === CompanyType::Provider) {
                $validator->errors()->add('type', 'Provider companies cannot create X Dock loads without a network provider.');
            }

            $deliveryId = $this->integer('delivery_address_id');
            $this->assertAddressType($validator, 'delivery_address_id', $deliveryId, AddressType::Delivery, $companyId);

            if ($deliveryId === (int) $parent->delivery_address_id) {
                $validator->errors()->add('delivery_address_id', 'Delivery address must differ from the parent direct load delivery address.');
            }

            if ($childType === LoadType::XDock) {
                $xdockId = $this->integer('xdock_address_id');
                $this->assertAddressType($validator, 'xdock_address_id', $xdockId, AddressType::Delivery, $companyId);

                if ($xdockId === $deliveryId) {
                    $validator->errors()->add('xdock_address_id', 'X dock address must differ from the final delivery address.');
                }
            }

            $this->assertScheduleOrder($validator);
        });
    }

    public function withChildUpdateValidator(Validator $validator, Load $load): void
    {
        $validator->after(function (Validator $validator) use ($load): void {
            if ($load->parent_load_id === null) {
                $validator->errors()->add('type', 'Use the direct load endpoint for direct loads.');

                return;
            }

            $parent = $load->parent;
            if ($parent === null) {
                return;
            }

            $companyId = (int) $load->company_id;
            $deliveryId = $this->integer('delivery_address_id');
            $this->assertAddressType($validator, 'delivery_address_id', $deliveryId, AddressType::Delivery, $companyId);

            if ($deliveryId === (int) $parent->delivery_address_id) {
                $validator->errors()->add('delivery_address_id', 'Delivery address must differ from the parent direct load delivery address.');
            }

            if ($load->type === LoadType::XDock) {
                $xdockId = $this->integer('xdock_address_id');
                $this->assertAddressType($validator, 'xdock_address_id', $xdockId, AddressType::Delivery, $companyId);

                if ($xdockId === $deliveryId) {
                    $validator->errors()->add('xdock_address_id', 'X dock address must differ from the final delivery address.');
                }
            }

            $this->assertScheduleOrder($validator);
        });
    }

    private function assertScheduleOrder(Validator $validator): void
    {
        $pickupDate = $this->input('pickup_date');
        $pickupTime = $this->input('pickup_time');
        $dropoffDate = $this->input('dropoff_date');
        $dropoffTime = $this->input('dropoff_time');

        if (
            ! is_string($pickupDate) || ! is_string($pickupTime)
            || ! is_string($dropoffDate) || ! is_string($dropoffTime)
        ) {
            return;
        }

        $pickup = strtotime($pickupDate.' '.$pickupTime.':00');
        $dropoff = strtotime($dropoffDate.' '.$dropoffTime.':00');

        if ($pickup === false || $dropoff === false) {
            return;
        }

        if ($dropoff < $pickup) {
            $validator->errors()->add('dropoff_date', 'Drop-off must be on or after pickup.');
        }
    }

    private function assertAddressType(
        Validator $validator,
        string $key,
        int $addressId,
        AddressType $expected,
        int $companyId,
    ): void {
        if ($addressId <= 0) {
            return;
        }

        $address = Address::query()
            ->where('company_id', $companyId)
            ->whereKey($addressId)
            ->first();

        if ($address === null) {
            return;
        }

        if ($address->type !== $expected) {
            $validator->errors()->add(
                $key,
                $expected === AddressType::Collection
                    ? 'Collection point must be a collection address.'
                    : 'Address must be a delivery address.',
            );
        }
    }

    /**
     * @return array{vehicle_body_type_id: ?int, vehicle_option_values: ?array<string, mixed>}
     */
    public function resolvedTruckTypeFields(): array
    {
        $rawId = $this->input('vehicle_body_type_id');
        if ($rawId === null || $rawId === '' || (int) $rawId <= 0) {
            return [
                'vehicle_body_type_id' => null,
                'vehicle_option_values' => null,
            ];
        }

        $values = $this->input('vehicle_option_values');
        if (! is_array($values) || $values === []) {
            return [
                'vehicle_body_type_id' => (int) $rawId,
                'vehicle_option_values' => null,
            ];
        }

        return [
            'vehicle_body_type_id' => (int) $rawId,
            'vehicle_option_values' => $values,
        ];
    }

    private function assertDirectTruckType(Validator $validator, ?Load $existing = null): void
    {
        $companyId = $this->user()?->company_id;
        if ($companyId === null) {
            return;
        }

        $rawId = $this->input('vehicle_body_type_id');

        if ($rawId === null || $rawId === '' || (int) $rawId <= 0) {
            $optionInput = $this->input('vehicle_option_values');
            if (is_array($optionInput) && $optionInput !== []) {
                $validator->errors()->add(
                    'vehicle_option_values',
                    'Remove truck type option values when no truck type is selected.',
                );
            }

            $this->merge([
                'vehicle_body_type_id' => null,
                'vehicle_option_values' => null,
            ]);

            return;
        }

        $bodyTypeId = (int) $rawId;
        $isCurrent = $existing !== null && (int) $existing->vehicle_body_type_id === $bodyTypeId;

        $bodyTypeQuery = VehicleBodyType::query();
        if ($isCurrent) {
            $bodyTypeQuery->withTrashed();
        }

        $bodyType = $bodyTypeQuery
            ->with([
                'options' => static fn ($query) => $query
                    ->where('visibility', VehicleBodyTypeOptionVisibility::Public)
                    ->orderBy('sort_order')
                    ->orderBy('id'),
            ])
            ->whereHas(
                'category',
                static function ($query) use ($isCurrent): void {
                    if ($isCurrent) {
                        $query->withTrashed();
                    }
                },
            )
            ->whereKey($bodyTypeId)
            ->first();

        $optionInput = $this->input('vehicle_option_values');
        if (! $this->has('vehicle_option_values') && $existing !== null && $isCurrent) {
            $optionInput = $existing->vehicle_option_values;
        }

        if ($bodyType === null) {
            $validator->errors()->add('vehicle_body_type_id', 'Invalid truck type.');

            return;
        }

        if (! $isCurrent) {
            if ($bodyType->trashed()) {
                $validator->errors()->add('vehicle_body_type_id', 'Invalid truck type.');

                return;
            }

            $company = Company::query()->find($companyId);
            if ($company === null || ! $company->vehicleBodyTypes()->whereKey($bodyTypeId)->exists()) {
                $validator->errors()->add(
                    'vehicle_body_type_id',
                    'This truck type is not active for your company.',
                );

                return;
            }
        }

        try {
            $normalized = app(VehicleBodyTypeOptionValuesValidator::class)->validateAndNormalize(
                $bodyType,
                is_array($optionInput) ? $optionInput : null,
                'vehicle_option_values',
                true,
            );
        } catch (ValidationException $exception) {
            foreach ($exception->errors() as $key => $messages) {
                foreach ($messages as $message) {
                    $validator->errors()->add($key, $message);
                }
            }

            return;
        }

        $this->merge([
            'vehicle_body_type_id' => $bodyTypeId,
            'vehicle_option_values' => $normalized === [] ? null : $normalized,
        ]);
    }

    /**
     * @return array<string, int|null>
     */
    public function resolvedPartyIds(): array
    {
        $companyId = $this->user()?->company_id;
        $owner = $companyId !== null ? Company::query()->find($companyId) : null;

        if ($owner === null) {
            return [
                'customer_company_id' => $this->integer('customer_company_id') ?: null,
                'provider_company_id' => $this->integer('provider_company_id') ?: null,
            ];
        }

        return match ($owner->company_type) {
            CompanyType::Customer => [
                'customer_company_id' => $owner->id,
                'provider_company_id' => $this->integer('provider_company_id'),
            ],
            CompanyType::Provider => [
                'customer_company_id' => $this->integer('customer_company_id'),
                'provider_company_id' => $owner->id,
            ],
            default => [
                'customer_company_id' => $this->integer('customer_company_id'),
                'provider_company_id' => $this->integer('provider_company_id'),
            ],
        };
    }
}

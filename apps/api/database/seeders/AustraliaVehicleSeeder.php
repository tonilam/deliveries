<?php

namespace Database\Seeders;

use App\Enums\VehicleBodyTypeCapacityUnit;
use App\Enums\VehicleBodyTypeOptionDataType;
use App\Enums\VehicleBodyTypeOptionVisibility;
use App\Models\VehicleBodyType;
use App\Models\VehicleBodyTypeOption;
use App\Models\VehicleCategory;
use Illuminate\Database\Seeder;

class AustraliaVehicleSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['code' => 'light_commercial', 'name' => 'Light commercial', 'sort_order' => 10],
            ['code' => 'rigid', 'name' => 'Rigid', 'sort_order' => 20],
            ['code' => 'semi_trailer', 'name' => 'Semi-trailer', 'sort_order' => 30],
            ['code' => 'b_double', 'name' => 'B-double', 'sort_order' => 40],
            ['code' => 'truck_and_dog', 'name' => 'Truck and dog', 'sort_order' => 50],
            ['code' => 'road_train', 'name' => 'Road train', 'sort_order' => 60],
        ];

        foreach ($categories as $row) {
            VehicleCategory::query()->updateOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name'], 'sort_order' => $row['sort_order']],
            );
        }

        /** @var array<string, list<array<string, mixed>>> $bodyTypesByCategory */
        $bodyTypesByCategory = [
            'light_commercial' => [
                [
                    'code' => 'pantech',
                    'name' => 'Pantech',
                    'capacity' => 4,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 4,
                    'payload_kg' => 1000,
                ],
            ],
            'rigid' => [
                [
                    'code' => 'tautliner',
                    'name' => 'Tautliner',
                    'capacity' => 14,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 14,
                    'payload_kg' => 9000,
                    'mezzanine_option' => true,
                ],
                [
                    'code' => 'pantech',
                    'name' => 'Pantech',
                    'capacity' => 14,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 14,
                    'payload_kg' => 8500,
                ],
                [
                    'code' => 'reefer',
                    'name' => 'Refrigerated',
                    'capacity' => 14,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 12,
                    'payload_kg' => 8000,
                ],
                [
                    'code' => 'tipper',
                    'name' => 'Tipper',
                    'capacity' => 12,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::M3,
                    'payload_kg' => 15000,
                ],
            ],
            'semi_trailer' => [
                [
                    'code' => 'tautliner',
                    'name' => 'Tautliner',
                    'capacity' => 22,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 22,
                    'cubic_metres' => 80,
                    'payload_kg' => 22000,
                    'mezzanine_option' => true,
                ],
                [
                    'code' => 'pantech',
                    'name' => 'Pantech',
                    'capacity' => 22,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 22,
                    'cubic_metres' => 78,
                    'payload_kg' => 21000,
                ],
                [
                    'code' => 'reefer',
                    'name' => 'Refrigerated',
                    'capacity' => 22,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 20,
                    'cubic_metres' => 70,
                    'payload_kg' => 20000,
                ],
                [
                    'code' => 'flat_top',
                    'name' => 'Flat top',
                    'capacity' => 22,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 22,
                    'payload_kg' => 24000,
                ],
                [
                    'code' => 'skeletal',
                    'name' => 'Container skeletal',
                    'capacity' => 2,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'description' => 'Two TEU container positions',
                    'payload_kg' => 28000,
                ],
                [
                    'code' => 'mezzanine_curtain',
                    'name' => 'Mezzanine curtain',
                    'capacity' => 40,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 40,
                    'cubic_metres' => 100,
                    'payload_kg' => 22000,
                    'mezzanine_option' => true,
                ],
                [
                    'code' => 'tipper',
                    'name' => 'Tipper',
                    'capacity' => 24,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::M3,
                    'payload_kg' => 26000,
                ],
                [
                    'code' => 'tanker',
                    'name' => 'Tanker',
                    'capacity' => 28000,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Litre,
                    'payload_kg' => 22000,
                ],
            ],
            'b_double' => [
                [
                    'code' => 'tautliner',
                    'name' => 'Tautliner',
                    'capacity' => 34,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 34,
                    'cubic_metres' => 120,
                    'payload_kg' => 32000,
                    'mezzanine_option' => true,
                ],
                [
                    'code' => 'reefer',
                    'name' => 'Refrigerated',
                    'capacity' => 34,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 32,
                    'payload_kg' => 30000,
                ],
                [
                    'code' => 'tipper',
                    'name' => 'Tipper',
                    'capacity' => 36,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::M3,
                    'payload_kg' => 35000,
                ],
            ],
            'truck_and_dog' => [
                [
                    'code' => 'tautliner',
                    'name' => 'Tautliner',
                    'capacity' => 28,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 28,
                    'payload_kg' => 28000,
                    'mezzanine_option' => true,
                ],
                [
                    'code' => 'tipper',
                    'name' => 'Tipper',
                    'capacity' => 30,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::M3,
                    'payload_kg' => 30000,
                ],
            ],
            'road_train' => [
                [
                    'code' => 'tautliner',
                    'name' => 'Tautliner',
                    'capacity' => 44,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::Pallet,
                    'pallet_spaces' => 44,
                    'payload_kg' => 40000,
                    'mezzanine_option' => true,
                ],
                [
                    'code' => 'tipper',
                    'name' => 'Tipper',
                    'capacity' => 48,
                    'capacity_unit' => VehicleBodyTypeCapacityUnit::M3,
                    'payload_kg' => 42000,
                ],
            ],
        ];

        foreach ($bodyTypesByCategory as $categoryCode => $bodyTypes) {
            $category = VehicleCategory::query()->where('code', $categoryCode)->firstOrFail();

            foreach ($bodyTypes as $row) {
                $mezzanine = (bool) ($row['mezzanine_option'] ?? false);
                unset($row['mezzanine_option']);

                $optionValues = $mezzanine ? ['mezzanine' => false] : [];

                /** @var VehicleBodyType $bodyType */
                $bodyType = VehicleBodyType::query()
                    ->withTrashed()
                    ->updateOrCreate(
                        [
                            'vehicle_category_id' => $category->id,
                            'code' => $row['code'],
                        ],
                        [
                            'name' => $row['name'],
                            'capacity' => $row['capacity'],
                            'capacity_unit' => $row['capacity_unit'],
                            'pallet_spaces' => $row['pallet_spaces'] ?? null,
                            'cubic_metres' => $row['cubic_metres'] ?? null,
                            'payload_kg' => $row['payload_kg'] ?? null,
                            'description' => $row['description'] ?? null,
                            'option_values' => $optionValues,
                        ],
                    );

                if ($bodyType->trashed()) {
                    $bodyType->restore();
                }

                if ($mezzanine) {
                    VehicleBodyTypeOption::query()->updateOrCreate(
                        [
                            'vehicle_body_type_id' => $bodyType->id,
                            'key' => 'mezzanine',
                        ],
                        [
                            'label' => 'Mezzanine',
                            'data_type' => VehicleBodyTypeOptionDataType::Boolean,
                            'visibility' => VehicleBodyTypeOptionVisibility::Public,
                            'required' => true,
                            'sort_order' => 0,
                        ],
                    );
                } else {
                    $bodyType->options()->where('key', 'mezzanine')->delete();
                }
            }
        }
    }
}

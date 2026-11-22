export type VehicleCapacityUnit = 'pallet' | 'm3' | 'tonne' | 'litre' | 'head';

export type VehicleOptionDataType = 'varchar' | 'boolean';

export type VehicleOptionVisibility = 'public' | 'system';

export interface VehicleCategory {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  body_types_count: number;
  body_types?: VehicleBodyType[];
}

export interface VehicleBodyType {
  id: number;
  vehicle_category_id: number;
  name: string;
  code: string;
  capacity: number;
  capacity_unit: VehicleCapacityUnit;
  pallet_spaces: number | null;
  cubic_metres: number | null;
  payload_kg: number | null;
  description: string | null;
  option_values: Record<string, string | boolean>;
  options?: VehicleBodyTypeOption[];
}

export interface VehicleBodyTypeOption {
  id: number;
  vehicle_body_type_id: number;
  key: string;
  label: string;
  data_type: VehicleOptionDataType;
  visibility: VehicleOptionVisibility;
  required: boolean;
  sort_order: number;
}

export interface CustomerVehicleBodyType {
  id: number;
  vehicle_category_id: number;
  name: string;
  code: string;
  capacity: number;
  capacity_unit: VehicleCapacityUnit;
  pallet_spaces: number | null;
  cubic_metres: number | null;
  payload_kg: number | null;
  description: string | null;
  active: boolean;
}

export interface CustomerVehicleCategory {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  body_types: CustomerVehicleBodyType[];
}

export interface VehicleBodyTypeOptionRow {
  id: number;
  name: string;
  code: string;
  vehicle_category_id: number;
  category_name: string | null;
  capacity: number;
  capacity_unit: VehicleCapacityUnit;
}

export const VEHICLE_CAPACITY_UNITS: { value: VehicleCapacityUnit; label: string }[] = [
  { value: 'pallet', label: 'Pallets' },
  { value: 'm3', label: 'Cubic metres' },
  { value: 'tonne', label: 'Tonnes' },
  { value: 'litre', label: 'Litres' },
  { value: 'head', label: 'Head (livestock)' },
];

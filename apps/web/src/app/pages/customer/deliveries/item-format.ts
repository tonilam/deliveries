export type ItemDisplayUnit = 'tonnes' | 'kg';

export interface ItemRow {
  id: number;
  good_type_code: string;
  good_type: string;
  weight_tonnes: string;
  display_unit: ItemDisplayUnit;
  order_number: string | null;
  connote: string | null;
  load_id?: number | null;
}

const KG_PER_TONNE = 1000;

export function displayUnitLabel(unit: ItemDisplayUnit): string {
  return unit === 'kg' ? 'kg' : 'tonnes';
}

export function formatWeightForDisplay(tonnes: string, unit: ItemDisplayUnit): string {
  const t = Number.parseFloat(tonnes);
  if (Number.isNaN(t)) {
    return tonnes;
  }
  if (unit === 'kg') {
    const kg = t * KG_PER_TONNE;
    return Number.isInteger(kg) ? String(kg) : kg.toFixed(3).replace(/\.?0+$/, '');
  }
  return tonnes;
}

export function weightInputToTonnes(value: number, unit: ItemDisplayUnit): number {
  return unit === 'kg' ? value / KG_PER_TONNE : value;
}

export function weightTonnesToInput(tonnes: string, unit: ItemDisplayUnit): number {
  const t = Number.parseFloat(tonnes);
  if (Number.isNaN(t)) {
    return 0;
  }
  return unit === 'kg' ? t * KG_PER_TONNE : t;
}

import type { GridActionItem } from '../../../shared/ag-grid/grid-actions-cell';
export { GridActionsCell as ItemActionsCell } from '../../../shared/ag-grid/grid-actions-cell';

export type ItemActionItem = GridActionItem;

export interface ItemActionsCellRow {
  id: number;
  good_type: string;
  good_type_code?: string;
  weight_tonnes?: string;
  quantity?: number;
  total_weight_tonnes?: string;
  display_unit?: 'tonnes' | 'kg';
  order_number?: string | null;
  connote?: string | null;
}

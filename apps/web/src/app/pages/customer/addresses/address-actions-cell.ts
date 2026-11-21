import type { GridActionItem } from '../../../shared/ag-grid/grid-actions-cell';
export { GridActionsCell as AddressActionsCell } from '../../../shared/ag-grid/grid-actions-cell';

export type AddressActionItem = GridActionItem;

export interface AddressActionsCellRow {
  id: number;
  business_name: string;
}

import type { GridActionItem } from '../../../shared/ag-grid/grid-actions-cell';
export { GridActionsCell as CompanyActionsCell } from '../../../shared/ag-grid/grid-actions-cell';

export type CompanyActionItem = GridActionItem;

export interface CompanyActionsCellRow {
  id: number;
  business_name: string;
}

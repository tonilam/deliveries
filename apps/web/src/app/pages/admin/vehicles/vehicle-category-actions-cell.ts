import type { GridActionItem } from '../../../shared/ag-grid/grid-actions-cell';
export { GridActionsCell as VehicleCategoryActionsCell } from '../../../shared/ag-grid/grid-actions-cell';

export type VehicleCategoryActionItem = GridActionItem;

/** Shared row shape for catalogue grids (categories, zones, goods, countries, …). */
export interface VehicleCategoryActionsCellRow {
  id: number;
}

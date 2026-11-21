import type { GridActionItem } from '../../../shared/ag-grid/grid-actions-cell';
export { GridActionsCell as UserActionsCell } from '../../../shared/ag-grid/grid-actions-cell';

export type UserActionItem = GridActionItem;

export interface UserActionsCellRow {
  id: number;
  is_active: boolean;
  has_password: boolean;
}

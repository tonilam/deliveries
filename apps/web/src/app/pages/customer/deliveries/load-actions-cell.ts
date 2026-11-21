import type { GridActionItem } from '../../../shared/ag-grid/grid-actions-cell';
export { GridActionsCell as LoadActionsCell } from '../../../shared/ag-grid/grid-actions-cell';

export type LoadActionItem = GridActionItem;

export interface LoadActionsCellParams {
  actionsFor: (data: import('./load.types').LoadRow) => LoadActionItem[];
}

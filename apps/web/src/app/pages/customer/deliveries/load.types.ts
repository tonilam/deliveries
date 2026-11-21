export type LoadType = 'direct' | 'add_drop' | 'x_dock';
export type OwnerCompanyType = 'customer' | 'provider' | 'broker';

export interface LoadRow {
  id: number;
  parent_load_id: number | null;
  type: LoadType;
  type_label: string;
  customer_company_id: number;
  customer: string;
  provider_company_id: number;
  provider: string;
  secondary_provider_company_id: number | null;
  secondary_provider: string | null;
  collection_address_id: number;
  collection: string | null;
  delivery_address_id: number | null;
  delivery: string | null;
  xdock_address_id: number | null;
  xdock: string | null;
  pallet_count: number;
  item_count: number;
  children?: LoadRow[];
}

export interface LoadDetailGridRow {
  detailRow: true;
  detailParentId: number;
  children: LoadRow[];
}

export type LoadGridRow = LoadRow | LoadDetailGridRow;

export function isLoadDetailRow(row: LoadGridRow): row is LoadDetailGridRow {
  return 'detailRow' in row && row.detailRow === true;
}

export function childItemCountSum(load: LoadRow): number {
  return (load.children ?? []).reduce((sum, child) => sum + child.item_count, 0);
}

/** Parent Deliveries row: items on this load plus every child load. */
export function parentDisplayItemCount(load: LoadRow): number {
  return load.item_count + childItemCountSum(load);
}

/** Parent has child loads but items still assigned to the parent load itself. */
export function parentHasItemsOnParentLoad(load: LoadRow): boolean {
  return (load.children?.length ?? 0) > 0 && load.item_count > 0;
}

export interface ParentItemCountCellValue {
  total: number;
  warn: boolean;
}

/** Grid cell value — warn can change while total stays the same (e.g. after move to child). */
export function parentItemCountCellValue(load: LoadRow): ParentItemCountCellValue {
  return {
    total: parentDisplayItemCount(load),
    warn: parentHasItemsOnParentLoad(load),
  };
}

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

export interface LoadChildrenDetailRow {
  detailRow: true;
  kind: 'children';
  detailParentId: number;
  children: LoadRow[];
}

export interface LoadItemsDetailRow {
  detailRow: true;
  kind: 'items';
  detailParentId: number;
  loadId: number;
  itemCount: number;
}

export type LoadDetailGridRow = LoadChildrenDetailRow | LoadItemsDetailRow;

export type LoadGridRow = LoadRow | LoadDetailGridRow;

export function isLoadDetailRow(row: LoadGridRow): row is LoadDetailGridRow {
  return 'detailRow' in row && row.detailRow === true;
}

export function isLoadChildrenDetail(row: LoadDetailGridRow): row is LoadChildrenDetailRow {
  return row.kind === 'children';
}

export function isLoadItemsDetail(row: LoadDetailGridRow): row is LoadItemsDetailRow {
  return row.kind === 'items';
}

/** First-level Deliveries row: expand child loads or items on a pure direct load. */
export function directLoadCanExpand(load: LoadRow): boolean {
  if ((load.children?.length ?? 0) > 0) {
    return true;
  }
  return load.item_count > 0;
}

export function childLoadCanExpand(child: LoadRow): boolean {
  return child.item_count > 0;
}

export interface LoadChildItemDetailRow {
  childDetailRow: true;
  loadId: number;
  itemCount: number;
}

export type LoadChildGridRow = LoadRow | LoadChildItemDetailRow;

export function isLoadChildItemDetailRow(row: LoadChildGridRow): row is LoadChildItemDetailRow {
  return 'childDetailRow' in row && row.childDetailRow === true;
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

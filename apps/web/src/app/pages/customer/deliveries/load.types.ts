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

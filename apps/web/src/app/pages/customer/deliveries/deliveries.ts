import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  afterEveryRender,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  FilterChangedEvent,
  FilterModel,
  GridApi,
  GridReadyEvent,
  INumberFilterParams,
  IsFullWidthRowParams,
  ITextFilterParams,
  ModuleRegistry,
  NumberFilterModel,
  RowHeightParams,
  DateFilterModel,
  GridOptions,
  IDateFilterParams,
  SetFilterModel,
  SortChangedEvent,
  TextFilterModel,
  themeQuartz,
} from 'ag-grid-community';
import { catchError, of, Subject, switchMap, tap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../shared/data-list/data-list.types';
import { loadAddressFilterText, loadAddressListText } from './load-address';
import { LoadAddressCell } from './load-address-cell';
import { LoadActionItem, LoadActionsCell } from './load-actions-cell';
import { LoadDetailFullWidth } from './load-detail-full-width';
import { LoadExpandCell } from './load-expand-cell';
import {
  DIRECT_LOAD_KIND_BADGE_COLOR,
  DIRECT_LOAD_KIND_BADGE_SIZE,
  DirectLoadKindLabel,
  directLoadKind,
  LOAD_KIND_FILTER_LABELS,
  loadKindLabelToSlug,
} from './load-kind';
import { LoadKindCell } from './load-kind-cell';
import { LoadKindFilter } from './load-kind-filter';
import { LoadKindFloatingFilter } from './load-kind-floating-filter';
import { LoadItemCountCell } from './load-item-count-cell';
import { LoadItemsSlider } from './load-items-slider';
import { LoadXDockEditModal } from './load-xdock-edit-modal';
import {
  directLoadCanExpand,
  isLoadChildrenDetail,
  isLoadDetailRow,
  isLoadItemsDetail,
  LoadDetailGridRow,
  LoadGridRow,
  LoadRow,
  OwnerCompanyType,
  parentDisplayItemCount,
  parentHasItemsOnParentLoad,
  parentItemCountCellValue,
  ParentItemCountCellValue,
} from './load.types';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = [
  'id',
  'load_kind',
  'customer',
  'provider',
  'collection',
  'delivery',
  'pickup_date',
  'pickup_time',
  'dropoff_date',
  'dropoff_time',
  'pallet_count',
] as const;
type FilterableField = (typeof FILTERABLE_FIELDS)[number];
type SortableField = FilterableField | 'item_count' | 'truck_type';
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'customer';
const DEFAULT_DIRECTION: SortDirection = 'asc';

function childLoadsEquivalent(previous: LoadRow[], next: LoadRow[]): boolean {
  if (previous.length !== next.length) {
    return false;
  }
  return previous.every((row, index) => row.id === next[index]?.id);
}

const serverSideSortComparator = (): number => 0;

interface LoadsListMeta {
  own_company_type?: OwnerCompanyType;
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface LoadsListResponse {
  loads: LoadRow[];
  meta: LoadsListMeta;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

const serverSideNumberFilterParams: INumberFilterParams = {
  debounceMs: 300,
  maxNumConditions: 1,
  filterOptions: [
    'equals',
    'notEqual',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'inRange',
  ],
};

const DATE_FILTER_FIELDS = ['pickup_date', 'dropoff_date'] as const;
type DateFilterField = (typeof DATE_FILTER_FIELDS)[number];

const serverSideDateFilterParams: IDateFilterParams = {
  debounceMs: 300,
  maxNumConditions: 1,
  browserDatePicker: true,
  filterOptions: [
    'equals',
    'notEqual',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'inRange',
    'blank',
    'notBlank',
  ],
  comparator: () => 0,
};

@Component({
  selector: 'app-customer-deliveries',
  imports: [
    AgGridAngular,
    DataListComponent,
    FormsModule,
    RouterLink,
    LoadActionsCell,
    LoadDetailFullWidth,
    LoadExpandCell,
    LoadKindCell,
    LoadKindFilter,
    LoadKindFloatingFilter,
    LoadAddressCell,
    LoadItemCountCell,
    LoadItemsSlider,
    LoadXDockEditModal,
  ],
  templateUrl: './deliveries.html',
  styleUrls: ['../../../shared/portal-shell.scss', './deliveries.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDeliveries implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<LoadGridRow> | null = null;
  private suppressGridEvents = false;
  private lastCompactView: boolean | null = null;
  private filterModel: FilterModel = {};
  private rowsNeedLayout = false;
  private detailRowCache = new Map<string, LoadDetailGridRow>();

  constructor() {
    effect(() => {
      const isCompact = this.compact();
      if (this.lastCompactView === null) {
        this.lastCompactView = isCompact;
        return;
      }
      if (this.lastCompactView === isCompact) {
        return;
      }
      this.lastCompactView = isCompact;
      if (isCompact) {
        this.filterModel = {};
        this.gridApi = null;
      } else {
        this.searchQuery.set('');
      }
      this.page.set(1);
      this.loadLoads();
    });

    effect(() => {
      this.detailRowHeights();
      if (!this.gridApi) {
        return;
      }
      queueMicrotask(() => {
        this.gridApi?.resetRowHeights();
        this.gridApi?.onRowHeightChanged();
      });
    });

    afterEveryRender(() => {
      if (!this.rowsNeedLayout || !this.gridApi) {
        return;
      }
      this.rowsNeedLayout = false;
      this.gridApi.refreshCells({ columns: ['expand'], force: true });
      this.gridApi.resetRowHeights();
      this.gridApi.onRowHeightChanged();
    });

    effect(() => {
      const expanded = this.expandedLoadIds();
      const rows: LoadGridRow[] = [];
      const nextCache = new Map<string, LoadDetailGridRow>();
      let detailChildrenSynced = false;

      for (const load of this.loads()) {
        rows.push(load);
        if (!expanded.has(load.id)) {
          continue;
        }
        const children = load.children ?? [];
        if (children.length > 0) {
          const key = `${load.id}:children`;
          const cached = this.detailRowCache.get(key);
          let detail: LoadDetailGridRow;
          if (
            cached &&
            isLoadChildrenDetail(cached) &&
            childLoadsEquivalent(cached.children, children)
          ) {
            if (cached.children !== children) {
              cached.children = children;
              detailChildrenSynced = true;
            }
            detail = cached;
          } else {
            detail = { detailRow: true, kind: 'children', detailParentId: load.id, children };
          }
          nextCache.set(key, detail);
          rows.push(detail);
        } else if (load.item_count > 0) {
          const key = `${load.id}:items`;
          const cached = this.detailRowCache.get(key);
          const detail: LoadDetailGridRow =
            cached && isLoadItemsDetail(cached) && cached.itemCount === load.item_count
              ? cached
              : {
                  detailRow: true,
                  kind: 'items',
                  detailParentId: load.id,
                  loadId: load.id,
                  itemCount: load.item_count,
                };
          nextCache.set(key, detail);
          rows.push(detail);
        }
      }

      this.detailRowCache = nextCache;
      this.gridRowData.set(rows);
      if (detailChildrenSynced && this.gridApi) {
        queueMicrotask(() => this.gridApi?.refreshCells({ force: true }));
      }
    });
  }

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');
  protected readonly expandedLoadIds = signal<Set<number>>(new Set());
  protected readonly selectedLoadForItems = signal<LoadRow | null>(null);
  protected readonly editingXDock = signal<LoadRow | null>(null);
  protected readonly detailRowHeights = signal<Record<number, number>>({});

  protected readonly loads = signal<LoadRow[]>([]);
  protected readonly gridRowData = signal<LoadGridRow[]>([]);

  protected readonly loadListTitle = (row: LoadRow): string =>
    `${row.customer} → ${row.delivery ?? '—'}`;

  protected readonly listColumns: DataListColumn<LoadRow>[] = [
    { field: 'id', label: 'Load ID', valueFor: (row) => String(row.id) },
    {
      field: 'type',
      label: 'Load type',
      badgeValueFor: (row) => directLoadKind(row),
      subValueBadgeColor: DIRECT_LOAD_KIND_BADGE_COLOR,
      subValueBadgeSize: DIRECT_LOAD_KIND_BADGE_SIZE,
    },
    { field: 'customer', label: 'Customer', valueFor: (row) => row.customer },
    { field: 'provider', label: 'Provider', valueFor: (row) => row.provider },
    {
      field: 'collection',
      label: 'Collection',
      valueFor: (row) => loadAddressListText(row, 'collection'),
    },
    {
      field: 'delivery',
      label: 'Delivery',
      valueFor: (row) => loadAddressListText(row, 'delivery'),
    },
    { field: 'pickup_date', label: 'Pickup date', valueFor: (row) => row.pickup_date },
    { field: 'pickup_time', label: 'Pickup time', valueFor: (row) => row.pickup_time },
    { field: 'dropoff_date', label: 'Drop-off date', valueFor: (row) => row.dropoff_date },
    { field: 'dropoff_time', label: 'Drop-off time', valueFor: (row) => row.dropoff_time },
    {
      field: 'truck_type',
      label: 'Truck Type',
      valueFor: (row) => row.truck_type ?? '',
    },
    { field: 'pallet_count', label: 'Pallets', valueFor: (row) => String(row.pallet_count) },
    {
      field: 'item_count',
      label: 'Items',
      valueFor: (row) => {
        const total = parentDisplayItemCount(row);
        return parentHasItemsOnParentLoad(row) ? `${total} — Check items` : String(total);
      },
    },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'id', label: 'Load ID' },
    { field: 'load_kind', label: 'Load type' },
    { field: 'customer', label: 'Customer' },
    { field: 'provider', label: 'Provider' },
    { field: 'collection', label: 'Collection' },
    { field: 'delivery', label: 'Delivery' },
    { field: 'pickup_date', label: 'Pickup date' },
    { field: 'pickup_time', label: 'Pickup time' },
    { field: 'dropoff_date', label: 'Drop-off date' },
    { field: 'dropoff_time', label: 'Drop-off time' },
    { field: 'truck_type', label: 'Truck Type' },
    { field: 'pallet_count', label: 'Pallets' },
    { field: 'item_count', label: 'Items' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly gridOptions: GridOptions<LoadGridRow> = {
    domLayout: 'autoHeight',
    alwaysShowVerticalScroll: false,
  };
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingDelete = signal<LoadRow | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<LoadsListMeta | null>(null);

  protected readonly columnDefs: ColDef<LoadGridRow>[] = [
    {
      colId: 'expand',
      headerName: '',
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      cellRenderer: LoadExpandCell,
      cellRendererParams: {
        isExpanded: (loadId: number) => this.expandedLoadIds().has(loadId),
        toggle: (loadId: number) => this.toggleExpand(loadId),
        canExpand: (load: LoadRow) => directLoadCanExpand(load),
        expandTarget: 'auto',
      },
    },
    {
      field: 'id',
      headerName: 'Load ID',
      width: 88,
      minWidth: 72,
      maxWidth: 104,
      comparator: serverSideSortComparator,
      filter: 'agNumberColumnFilter',
      filterParams: serverSideNumberFilterParams,
      valueGetter: (params) => (isLoadDetailRow(params.data!) ? null : params.data?.id),
    },
    {
      colId: 'load_kind',
      headerName: 'Load type',
      width: 108,
      minWidth: 96,
      maxWidth: 124,
      comparator: serverSideSortComparator,
      filter: LoadKindFilter,
      floatingFilterComponent: LoadKindFloatingFilter,
      suppressHeaderFilterButton: true,
      suppressFloatingFilterButton: true,
      cellRenderer: LoadKindCell,
      filterValueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return directLoadKind(data);
      },
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return directLoadKind(data);
      },
    },
    {
      field: 'customer',
      headerName: 'Customer',
      flex: 1,
      minWidth: 130,
      sort: DEFAULT_DIRECTION,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueGetter: (params) => (isLoadDetailRow(params.data!) ? '' : (params.data?.customer ?? '')),
    },
    {
      field: 'provider',
      headerName: 'Provider',
      flex: 1,
      minWidth: 130,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueGetter: (params) => (isLoadDetailRow(params.data!) ? '' : (params.data?.provider ?? '')),
    },
    {
      field: 'collection',
      headerName: 'Collection',
      flex: 1.1,
      minWidth: 150,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      cellRenderer: LoadAddressCell,
      cellRendererParams: { kind: 'collection' },
      cellClass: 'deliveries-grid__address-cell',
      wrapText: true,
      autoHeight: true,
      filterValueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return loadAddressFilterText(data, 'collection');
      },
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return loadAddressFilterText(data, 'collection');
      },
    },
    {
      field: 'delivery',
      headerName: 'Delivery',
      flex: 1.1,
      minWidth: 150,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      cellRenderer: LoadAddressCell,
      cellRendererParams: { kind: 'delivery' },
      cellClass: 'deliveries-grid__address-cell',
      wrapText: true,
      autoHeight: true,
      filterValueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return loadAddressFilterText(data, 'delivery');
      },
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return loadAddressFilterText(data, 'delivery');
      },
    },
    {
      field: 'pickup_date',
      headerName: 'Pickup date',
      width: 120,
      minWidth: 108,
      comparator: serverSideSortComparator,
      filter: 'agDateColumnFilter',
      filterParams: serverSideDateFilterParams,
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return data.pickup_date;
      },
    },
    {
      field: 'pickup_time',
      headerName: 'Pickup time',
      width: 108,
      minWidth: 96,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return data.pickup_time;
      },
    },
    {
      field: 'dropoff_date',
      headerName: 'Drop-off date',
      width: 120,
      minWidth: 108,
      comparator: serverSideSortComparator,
      filter: 'agDateColumnFilter',
      filterParams: serverSideDateFilterParams,
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return data.dropoff_date;
      },
    },
    {
      field: 'dropoff_time',
      headerName: 'Drop-off time',
      width: 118,
      minWidth: 104,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return data.dropoff_time;
      },
    },
    {
      field: 'truck_type',
      headerName: 'Truck Type',
      flex: 1,
      minWidth: 140,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      filterValueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return data.truck_type_code ?? '';
      },
      valueGetter: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return '';
        }
        return data.truck_type_code ?? '';
      },
    },
    {
      field: 'pallet_count',
      headerName: 'Pallets',
      width: 100,
      comparator: serverSideSortComparator,
      filter: 'agNumberColumnFilter',
      filterParams: serverSideNumberFilterParams,
      valueGetter: (params) => (isLoadDetailRow(params.data!) ? null : params.data?.pallet_count),
    },
    {
      field: 'item_count',
      headerName: 'Items',
      width: 108,
      minWidth: 96,
      comparator: serverSideSortComparator,
      filter: false,
      floatingFilter: false,
      cellRenderer: LoadItemCountCell,
      cellClass: (params) => {
        const data = params.data;
        if (!data || isLoadDetailRow(data)) {
          return undefined;
        }
        return parentHasItemsOnParentLoad(data) ? 'deliveries-grid__items-cell--warn' : undefined;
      },
      valueGetter: (params) => {
        if (isLoadDetailRow(params.data!)) {
          return null;
        }
        const row = params.data as LoadRow;
        return parentItemCountCellValue(row);
      },
      equals: (a, b) => {
        if (a === b) {
          return true;
        }
        if (a == null || b == null) {
          return a === b;
        }
        const left = a as ParentItemCountCellValue;
        const right = b as ParentItemCountCellValue;
        return left.total === right.total && left.warn === right.warn;
      },
    },
    {
      headerName: 'Actions',
      width: 100,
      minWidth: 100,
      maxWidth: 100,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      cellClass: 'deliveries-grid__actions-cell',
      cellRenderer: LoadActionsCell,
      cellRendererParams: {
        actionsFor: (data: LoadGridRow) =>
          isLoadDetailRow(data) ? [] : this.actionsForRow(data as LoadRow),
      },
    },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    sortingOrder: ['asc', 'desc'],
  };

  protected readonly isFullWidthRow = (params: IsFullWidthRowParams<LoadGridRow>) =>
    params.rowNode.data !== undefined && isLoadDetailRow(params.rowNode.data);

  protected readonly fullWidthCellRenderer = LoadDetailFullWidth;

  protected readonly fullWidthCellRendererParams = {
    onActionsFor: (child: LoadRow) => this.actionsForChildRow(child),
    onDetailHeight: (parentLoadId: number, height: number) => {
      this.detailRowHeights.update((current) => {
        if (current[parentLoadId] === height) {
          return current;
        }
        return { ...current, [parentLoadId]: height };
      });
    },
  };

  protected readonly getRowId = (params: { data: LoadGridRow }): string => {
    if (isLoadDetailRow(params.data)) {
      return `detail-${params.data.detailParentId}-${params.data.kind}`;
    }
    return `load-${params.data.id}`;
  };

  protected readonly getRowHeight = (params: RowHeightParams<LoadGridRow>) => {
    const data = params.data;
    if (data && isLoadDetailRow(data)) {
      const measured = this.detailRowHeights()[data.detailParentId];
      if (measured) {
        return measured;
      }
      if (isLoadChildrenDetail(data)) {
        const childRows = data.children.length;
        return 130 + childRows * 48;
      }
      return 56 + data.itemCount * 42;
    }
    return undefined;
  };

  ngOnInit(): void {
    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http.get<LoadsListResponse>('/api/loads', { params: this.buildParams() }).pipe(
            catchError(() => {
              const lastGood = this.meta();
              if (lastGood) {
                this.page.set(lastGood.current_page);
                if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                  this.pageSize.set(lastGood.per_page as PageSize);
                }
              }
              this.error.set('Unable to load deliveries. Please try again.');
              this.loading.set(false);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((res) => {
        if (!res) {
          return;
        }
        this.loads.set(res.loads);
        if (this.expandedLoadIds().size > 0) {
          this.rowsNeedLayout = true;
        }
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);

        const managing = this.selectedLoadForItems();
        if (managing) {
          const updated = res.loads.find((load) => load.id === managing.id);
          if (updated) {
            this.selectedLoadForItems.set(updated);
          }
        }

        if (this.gridApi) {
          queueMicrotask(() => {
            this.gridApi?.refreshCells({ force: true, columns: ['item_count'] });
          });
        }
      });

    this.loadLoads();

    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('edit_load');
      if (!raw) {
        return;
      }
      const id = Number(raw);
      if (!Number.isInteger(id) || id < 1) {
        return;
      }
      this.openXDockEditById(id);
    });
  }

  protected closeXDockEdit(): void {
    this.editingXDock.set(null);
  }

  protected onXDockSaved(): void {
    this.loadLoads();
  }

  protected toggleExpand(loadId: number): void {
    this.rowsNeedLayout = true;
    this.expandedLoadIds.update((current) => {
      const next = new Set(current);
      if (next.has(loadId)) {
        next.delete(loadId);
        this.detailRowHeights.update((heights) => {
          if (!(loadId in heights)) {
            return heights;
          }
          const next = { ...heights };
          delete next[loadId];
          return next;
        });
      } else {
        next.add(loadId);
      }
      return next;
    });
  }

  protected openManageItems(row: LoadRow): void {
    this.selectedLoadForItems.set(row);
  }

  protected closeItemsSlider(): void {
    this.selectedLoadForItems.set(null);
  }

  protected onItemsChanged(): void {
    this.loadLoads();
  }

  protected onGridReady(event: GridReadyEvent<LoadGridRow>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<LoadGridRow>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadLoads();
  }

  protected onSortChanged(event: SortChangedEvent<LoadGridRow>): void {
    if (this.suppressGridEvents) {
      return;
    }

    const sorted = event.api
      .getColumnState()
      .find((column) => column.sort === 'asc' || column.sort === 'desc');

    const nextField =
      sorted?.colId && this.isSortableField(sorted.colId) ? sorted.colId : DEFAULT_SORT;
    const nextDirection: SortDirection =
      sorted?.sort === 'asc' || sorted?.sort === 'desc' ? sorted.sort : DEFAULT_DIRECTION;

    if (nextField === this.sortField && nextDirection === this.sortDirection) {
      return;
    }

    this.sortField = nextField;
    this.sortDirection = nextDirection;
    this.page.set(1);
    this.loadLoads();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadLoads();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadLoads();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadLoads();
  }

  protected actionsForList = (data: LoadRow): DataListAction<LoadRow>[] => {
    return [
      {
        id: 'edit',
        label: 'Edit',
        variant: 'primary',
        run: (row) => this.goToEdit(row),
      },
      {
        id: 'items',
        label: 'Manage items',
        variant: 'ghost',
        run: (row) => this.openManageItems(row),
      },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'danger',
        run: (row) => this.requestDelete(row),
      },
    ];
  };

  protected onPageSizeChange(value: number): void {
    const next = value as PageSize;
    if (!PAGE_SIZE_OPTIONS.includes(next) || next === this.pageSize()) {
      return;
    }
    this.pageSize.set(next);
    this.page.set(1);
    this.loadLoads();
  }

  protected requestDelete(row: LoadRow): void {
    if (this.deleting()) {
      return;
    }
    this.error.set(null);
    this.pendingDelete.set(row);
  }

  protected cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  protected confirmDelete(): void {
    const pending = this.pendingDelete();
    if (!pending || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.delete(`/api/loads/${pending.id}`)))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.loadLoads();
          this.toastr.success('Load deleted.');
        },
        error: () => {
          const message = 'Unable to delete load. Please try again.';
          this.error.set(message);
          this.toastr.error(message);
          this.deleting.set(false);
        },
      });
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadLoads();
  }

  private goToEdit(row: LoadRow): void {
    if (row.type === 'x_dock') {
      this.editingXDock.set(row);
      return;
    }
    void this.router.navigate(['/app/deliveries', row.id, 'edit']);
  }

  private openXDockEditById(id: number): void {
    this.http.get<{ load: LoadRow }>(`/api/loads/${id}`).subscribe({
      next: (res) => {
        if (res.load.type !== 'x_dock') {
          this.clearEditLoadQueryParam();
          void this.router.navigate(['/app/deliveries', res.load.id, 'edit']);
          return;
        }
        this.editingXDock.set(res.load);
        this.clearEditLoadQueryParam();
      },
      error: () => {
        this.toastr.error('Unable to open X Dock load.');
        this.clearEditLoadQueryParam();
      },
    });
  }

  private clearEditLoadQueryParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit_load: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private actionsForRow(data: LoadRow): LoadActionItem[] {
    return [
      { id: 'edit', label: 'Edit', run: () => this.goToEdit(data) },
      { id: 'items', label: 'Manage items', run: () => this.openManageItems(data) },
      { id: 'delete', label: 'Delete', run: () => this.requestDelete(data) },
    ];
  }

  private actionsForChildRow(child: LoadRow): LoadActionItem[] {
    return [
      { id: 'edit', label: 'Edit', run: () => this.goToEdit(child) },
      { id: 'items', label: 'Manage items', run: () => this.openManageItems(child) },
      { id: 'delete', label: 'Delete', run: () => this.requestDelete(child) },
    ];
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('page', String(this.page()))
      .set('per_page', String(this.pageSize()))
      .set('sort', this.sortField)
      .set('direction', this.sortDirection);

    if (this.compact()) {
      const search = this.searchQuery().trim();
      if (search !== '') {
        params = params.set('search', search);
      }
      return params;
    }

    for (const field of FILTERABLE_FIELDS) {
      const model = this.filterModel[field];
      if (!model) {
        continue;
      }

      if (field === 'load_kind') {
        params = this.appendLoadKindSetFilterParams(params, model);
        continue;
      }

      if (field === 'pallet_count' || field === 'id') {
        params = this.appendNumberFilterParams(params, model, field);
        continue;
      }

      if (this.isDateFilterField(field)) {
        params = this.appendDateFilterParams(params, model, field);
        continue;
      }

      if (!this.isTextFilterModel(model) || !model.type) {
        continue;
      }

      const isBlankType = model.type === 'blank' || model.type === 'notBlank';
      const filterText = typeof model.filter === 'string' ? model.filter.trim() : '';
      if (!isBlankType && filterText === '') {
        continue;
      }

      params = params.set(`filter[${field}][type]`, model.type);
      if (!isBlankType) {
        params = params.set(`filter[${field}][filter]`, filterText);
      }
    }

    return params;
  }

  private isDateFilterField(field: string): field is DateFilterField {
    return (DATE_FILTER_FIELDS as readonly string[]).includes(field);
  }

  private normalizeFilterDate(value: string | null | undefined): string | null {
    if (value == null || value === '') {
      return null;
    }
    return value.length >= 10 ? value.slice(0, 10) : null;
  }

  private appendDateFilterParams(
    params: HttpParams,
    model: FilterModel[string],
    field: DateFilterField,
  ): HttpParams {
    if (!this.isDateFilterModel(model) || !model.type) {
      return params;
    }

    if (model.type === 'blank' || model.type === 'notBlank') {
      return params.set(`filter[${field}][type]`, model.type);
    }

    const from = this.normalizeFilterDate(model.dateFrom);
    if (from === null) {
      return params;
    }

    params = params.set(`filter[${field}][type]`, model.type).set(`filter[${field}][filter]`, from);

    if (model.type === 'inRange') {
      const to = this.normalizeFilterDate(model.dateTo);
      if (to !== null) {
        params = params.set(`filter[${field}][filterTo]`, to);
      }
    }

    return params;
  }

  private appendNumberFilterParams(
    params: HttpParams,
    model: FilterModel[string],
    field: 'id' | 'pallet_count',
  ): HttpParams {
    if (!this.isNumberFilterModel(model) || !model.type) {
      return params;
    }

    const filterValue = model.filter;
    if (filterValue == null || Number.isNaN(filterValue)) {
      return params;
    }

    params = params
      .set(`filter[${field}][type]`, model.type)
      .set(`filter[${field}][filter]`, String(filterValue));

    if (model.type === 'inRange' && model.filterTo != null && !Number.isNaN(model.filterTo)) {
      params = params.set(`filter[${field}][filterTo]`, String(model.filterTo));
    }

    return params;
  }

  private appendLoadKindSetFilterParams(
    params: HttpParams,
    model: FilterModel[string],
  ): HttpParams {
    if (!this.isSetFilterModel(model)) {
      return params;
    }

    const selected = (model.values ?? []).filter(
      (value): value is DirectLoadKindLabel =>
        typeof value === 'string' && (LOAD_KIND_FILTER_LABELS as readonly string[]).includes(value),
    );

    if (selected.length === 0) {
      return params
        .set('filter[load_kind][type]', 'equals')
        .set('filter[load_kind][filter]', '__no_match__');
    }

    if (selected.length >= LOAD_KIND_FILTER_LABELS.length) {
      return params;
    }

    const slugs = selected.map((label) => loadKindLabelToSlug(label)).join(',');

    return params.set('filter[load_kind][type]', 'in').set('filter[load_kind][filter]', slugs);
  }

  private isSetFilterModel(model: FilterModel[string] | null | undefined): model is SetFilterModel {
    if (!model || typeof model !== 'object' || !('values' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'set';
    return filterType === 'set';
  }

  private isTextFilterModel(
    model: FilterModel[string] | null | undefined,
  ): model is TextFilterModel {
    if (!model || typeof model !== 'object' || !('type' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'text';
    return filterType === 'text' || filterType == null;
  }

  private isDateFilterModel(
    model: FilterModel[string] | null | undefined,
  ): model is DateFilterModel {
    if (!model || typeof model !== 'object' || !('type' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'date';
    return filterType === 'date';
  }

  private isNumberFilterModel(
    model: FilterModel[string] | null | undefined,
  ): model is NumberFilterModel {
    if (!model || typeof model !== 'object' || !('type' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'number';
    return filterType === 'number';
  }

  private isSortableField(field: string): field is SortableField {
    return (
      [
        'id',
        'load_kind',
        'truck_type',
        'customer',
        'provider',
        'collection',
        'delivery',
        'pickup_date',
        'pickup_time',
        'dropoff_date',
        'dropoff_time',
        'pallet_count',
        'item_count',
      ] as const
    ).includes(field as SortableField);
  }

  private syncGridUiFromState(): void {
    if (!this.gridApi) {
      return;
    }

    this.suppressGridEvents = true;
    this.gridApi.setFilterModel(Object.keys(this.filterModel).length > 0 ? this.filterModel : null);
    this.gridApi.applyColumnState({
      defaultState: { sort: null },
      state: [{ colId: this.sortField, sort: this.sortDirection }],
    });
    queueMicrotask(() => {
      this.suppressGridEvents = false;
    });
  }

  private loadLoads(): void {
    this.load$.next();
  }
}

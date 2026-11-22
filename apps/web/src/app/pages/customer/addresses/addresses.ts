import { HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  FilterChangedEvent,
  FilterModel,
  GridApi,
  GridReadyEvent,
  INumberFilterParams,
  ITextFilterParams,
  ModuleRegistry,
  NumberFilterModel,
  SetFilterModel,
  SortChangedEvent,
  TextFilterModel,
  themeQuartz,
} from 'ag-grid-community';
import { catchError, of, Subject, switchMap, tap } from 'rxjs';

import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../shared/data-list/data-list.types';
import { AddressesApiService } from '../../../core/addresses/addresses-api.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import {
  AddressActionItem,
  AddressActionsCell,
  AddressActionsCellRow,
} from './address-actions-cell';
import { AddressTypeFilter } from './address-type-filter';
import { AddressTypeFloatingFilter } from './address-type-floating-filter';

ModuleRegistry.registerModules([AllCommunityModule]);

export type AddressType = 'collection' | 'delivery';

export interface AddressRow {
  id: number;
  type: AddressType;
  business_name: string;
  address: string;
  zone_id: number;
  zone: string;
  state: string;
  postcode: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = [
  'type',
  'business_name',
  'address',
  'zone',
  'state',
  'postcode',
] as const;
type SortableField = (typeof FILTERABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'business_name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

const TYPE_FILTER_LABELS = ['Collection', 'Delivery'] as const;

/** Keep row order as returned by the server (pagination is server-side). */
const serverSideSortComparator = (): number => 0;

interface AddressesListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface AddressesListResponse {
  addresses: AddressRow[];
  meta: AddressesListMeta;
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

function typeLabel(type: AddressType | undefined): string {
  if (type === 'collection') {
    return 'Collection';
  }
  if (type === 'delivery') {
    return 'Delivery';
  }
  return type ?? '';
}

function postcodeAsNumber(postcode: string | undefined | null): number | null {
  if (postcode == null || postcode.trim() === '') {
    return null;
  }
  const value = Number.parseInt(postcode.trim(), 10);
  return Number.isNaN(value) ? null : value;
}

@Component({
  selector: 'app-customer-addresses',
  imports: [
    AgGridAngular,
    DataListComponent,
    FormsModule,
    RouterLink,
    AddressTypeFilter,
    AddressTypeFloatingFilter,
  ],
  templateUrl: './addresses.html',
  styleUrls: ['../../../shared/portal-shell.scss', './addresses.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddresses implements OnInit {
  private readonly addressesApi = inject(AddressesApiService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<AddressRow> | null = null;
  private suppressGridEvents = false;
  private lastCompactView: boolean | null = null;
  private filterModel: FilterModel = {};

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
      this.loadAddresses();
    });
  }

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly addressListTitle = (row: AddressRow): string => row.business_name;

  protected readonly listColumns: DataListColumn<AddressRow>[] = [
    {
      field: 'type',
      label: 'Type',
      valueFor: (row) => typeLabel(row.type),
    },
    { field: 'address', label: 'Address' },
    { field: 'zone', label: 'Zone' },
    { field: 'state', label: 'State' },
    { field: 'postcode', label: 'Postcode' },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'type', label: 'Type' },
    { field: 'business_name', label: 'Business name' },
    { field: 'address', label: 'Address' },
    { field: 'zone', label: 'Zone' },
    { field: 'state', label: 'State' },
    { field: 'postcode', label: 'Postcode' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly addresses = signal<AddressRow[]>([]);
  protected readonly pendingDelete = signal<AddressActionsCellRow | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<AddressesListMeta | null>(null);

  protected readonly columnDefs: ColDef<AddressRow>[] = [
    {
      field: 'type',
      headerName: 'Type',
      flex: 0.9,
      minWidth: 132,
      comparator: serverSideSortComparator,
      filter: AddressTypeFilter,
      floatingFilterComponent: AddressTypeFloatingFilter,
      suppressHeaderFilterButton: true,
      suppressFloatingFilterButton: true,
      valueFormatter: (params) => typeLabel(params.value as AddressType | undefined),
      filterValueGetter: (params) => typeLabel(params.data?.type),
    },
    {
      field: 'business_name',
      headerName: 'Business name',
      flex: 1.2,
      minWidth: 160,
      sort: DEFAULT_DIRECTION,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1.4,
      minWidth: 180,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'zone',
      headerName: 'Zone',
      flex: 0.9,
      minWidth: 120,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'state',
      headerName: 'State',
      flex: 0.6,
      minWidth: 90,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'postcode',
      headerName: 'Postcode',
      flex: 0.7,
      minWidth: 100,
      comparator: serverSideSortComparator,
      filter: 'agNumberColumnFilter',
      filterParams: serverSideNumberFilterParams,
      filterValueGetter: (params) => postcodeAsNumber(params.data?.postcode),
    },
    {
      headerName: 'Actions',
      flex: 0,
      width: 100,
      minWidth: 100,
      maxWidth: 100,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      suppressSizeToFit: true,
      cellClass: 'addresses-grid__actions-cell',
      cellRenderer: AddressActionsCell,
      cellRendererParams: {
        actionsFor: (data: AddressActionsCellRow) => this.actionsFor(data),
      },
    },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    sortingOrder: ['asc', 'desc'],
  };

  ngOnInit(): void {
    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() => {
          return this.addressesApi.list<AddressesListResponse>(this.buildParams()).pipe(
            catchError(() => {
              const lastGood = this.meta();
              if (lastGood) {
                this.page.set(lastGood.current_page);
                if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                  this.pageSize.set(lastGood.per_page as PageSize);
                }
              }
              this.error.set('Unable to load addresses. Please try again.');
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        if (!res) {
          return;
        }
        this.addresses.set(res.addresses);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadAddresses();
  }

  protected onGridReady(event: GridReadyEvent<AddressRow>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<AddressRow>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadAddresses();
  }

  protected onSortChanged(event: SortChangedEvent<AddressRow>): void {
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
    this.loadAddresses();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadAddresses();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadAddresses();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadAddresses();
  }

  protected actionsForList = (data: AddressRow): DataListAction<AddressRow>[] => {
    return [
      {
        id: 'edit',
        label: 'Edit',
        variant: 'primary',
        run: (row) => {
          void this.router.navigateByUrl(`/app/addresses/${row.id}/edit`);
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'danger',
        run: (row) => {
          this.requestDelete(row);
        },
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
    this.loadAddresses();
  }

  protected requestDelete(row: AddressActionsCellRow): void {
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

    this.addressesApi.delete(pending.id).subscribe({
      next: () => {
        const remaining = this.addresses().filter((address) => address.id !== pending.id);
        this.addresses.set(remaining);
        this.pendingDelete.set(null);
        this.deleting.set(false);
        if (remaining.length === 0 && this.page() > 1) {
          this.page.set(this.page() - 1);
        }
        this.loadAddresses();
        this.toastr.success('Address deleted.');
      },
      error: () => {
        const message = 'Unable to delete address. Please try again.';
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
    this.loadAddresses();
  }

  private actionsFor(data: AddressActionsCellRow): AddressActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => {
          void this.router.navigateByUrl(`/app/addresses/${data.id}/edit`);
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        run: () => {
          this.requestDelete(data);
        },
      },
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

      if (field === 'type') {
        params = this.appendTypeSetFilterParams(params, model);
        continue;
      }

      if (field === 'postcode') {
        params = this.appendPostcodeFilterParams(params, model);
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

  private appendTypeSetFilterParams(params: HttpParams, model: FilterModel[string]): HttpParams {
    if (!this.isSetFilterModel(model)) {
      return params;
    }

    const selected = (model.values ?? []).filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    if (selected.length === 0) {
      return params.set('filter[type][type]', 'equals').set('filter[type][filter]', '__no_match__');
    }

    if (selected.length === 1) {
      return params.set('filter[type][type]', 'equals').set('filter[type][filter]', selected[0]);
    }

    if (selected.length >= TYPE_FILTER_LABELS.length) {
      return params;
    }

    return params;
  }

  private appendPostcodeFilterParams(params: HttpParams, model: FilterModel[string]): HttpParams {
    if (!this.isNumberFilterModel(model) || !model.type) {
      return params;
    }

    const isBlankType = model.type === 'blank' || model.type === 'notBlank';
    if (isBlankType) {
      return params.set('filter[postcode][type]', model.type).set('filter[postcode][filter]', '');
    }

    const filterValue = model.filter;
    if (filterValue == null || Number.isNaN(filterValue)) {
      return params;
    }

    params = params
      .set('filter[postcode][type]', model.type)
      .set('filter[postcode][filter]', String(filterValue));

    if (model.type === 'inRange' && model.filterTo != null && !Number.isNaN(model.filterTo)) {
      params = params.set('filter[postcode][filterTo]', String(model.filterTo));
    }

    return params;
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

  private isSetFilterModel(model: FilterModel[string] | null | undefined): model is SetFilterModel {
    if (!model || typeof model !== 'object' || !('values' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'set';
    return filterType === 'set';
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
    return (FILTERABLE_FIELDS as readonly string[]).includes(field);
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

  private loadAddresses(): void {
    this.load$.next();
  }
}

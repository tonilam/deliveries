import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  FilterChangedEvent,
  FilterModel,
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

import { AddressTypeFilter } from './address-type-filter';
import { AddressTypeFloatingFilter } from './address-type-floating-filter';

ModuleRegistry.registerModules([AllCommunityModule]);

export type AddressType = 'collection' | 'delivery';

export interface AddressRow {
  id: number;
  type: AddressType;
  business_name: string;
  address: string;
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
  imports: [AgGridAngular, FormsModule, RouterLink, AddressTypeFilter, AddressTypeFloatingFilter],
  templateUrl: './addresses.html',
  styleUrls: ['../../../shared/portal-shell.scss', './addresses.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddresses implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly load$ = new Subject<void>();
  private filterModel: FilterModel = {};
  private sortField: SortableField = DEFAULT_SORT;
  private sortDirection: SortDirection = DEFAULT_DIRECTION;

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly addresses = signal<AddressRow[]>([]);
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
          return this.http
            .get<AddressesListResponse>('/api/addresses', {
              params: this.buildParams(),
            })
            .pipe(
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

  protected onFilterChanged(event: FilterChangedEvent<AddressRow>): void {
    queueMicrotask(() => {
      this.filterModel = event.api.getFilterModel() ?? {};
      this.page.set(1);
      this.loadAddresses();
    });
  }

  protected onSortChanged(event: SortChangedEvent<AddressRow>): void {
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

  protected onPageSizeChange(value: number): void {
    const next = value as PageSize;
    if (!PAGE_SIZE_OPTIONS.includes(next) || next === this.pageSize()) {
      return;
    }
    this.pageSize.set(next);
    this.page.set(1);
    this.loadAddresses();
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadAddresses();
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('page', String(this.page()))
      .set('per_page', String(this.pageSize()))
      .set('sort', this.sortField)
      .set('direction', this.sortDirection);

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

  private loadAddresses(): void {
    this.load$.next();
  }
}

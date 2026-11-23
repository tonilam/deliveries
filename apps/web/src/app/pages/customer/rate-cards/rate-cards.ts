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
  ITextFilterParams,
  ModuleRegistry,
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
import { RateCardsApiService } from '../../../core/rate-cards/rate-cards-api.service';
import {
  AddressActionItem,
  AddressActionsCell,
  AddressActionsCellRow,
} from '../addresses/address-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

export type RateCardUserType = 'customer' | 'provider';

export interface RateCardRow {
  id: number;
  profile_name: string;
  user_type: RateCardUserType;
  is_active: boolean;
  linked_companies: string[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = ['profile_name', 'user_type', 'linked_companies', 'is_active'] as const;
type SortableField = (typeof FILTERABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'profile_name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

const serverSideSortComparator = (): number => 0;

interface RateCardsListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface RateCardsListResponse {
  rate_cards: RateCardRow[];
  meta: RateCardsListMeta;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

function userTypeLabel(type: RateCardUserType | undefined): string {
  if (type === 'customer') {
    return 'Customer';
  }
  if (type === 'provider') {
    return 'Provider';
  }
  return type ?? '';
}

function activeLabel(active: boolean | undefined): string {
  return active ? 'Yes' : 'No';
}

function linkedCompaniesColumnHeader(type: RateCardUserType | undefined): string {
  return type === 'provider' ? 'Providers' : 'Customers';
}

function linkedCompaniesDisplay(row: RateCardRow | undefined): string {
  if (!row) {
    return '';
  }
  if (row.linked_companies.length === 0) {
    return row.user_type === 'provider' ? 'All providers' : 'All customers';
  }
  return row.linked_companies.join('\n');
}

function linkedCompaniesFilterText(row: RateCardRow | undefined): string {
  if (!row?.linked_companies.length) {
    return row?.user_type === 'provider' ? 'All providers' : 'All customers';
  }
  return row.linked_companies.join(' ');
}

@Component({
  selector: 'app-customer-rate-cards',
  imports: [AgGridAngular, DataListComponent, FormsModule, RouterLink, AddressActionsCell],
  templateUrl: './rate-cards.html',
  styleUrls: ['../../../shared/portal-shell.scss', './rate-cards.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerRateCards implements OnInit {
  private readonly rateCardsApi = inject(RateCardsApiService);
  private readonly router = inject(Router);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<RateCardRow> | null = null;
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
      this.loadRateCards();
    });
  }

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly listTitle = (row: RateCardRow): string => row.profile_name;

  protected readonly listColumns: DataListColumn<RateCardRow>[] = [
    {
      field: 'user_type',
      label: 'User type',
      valueFor: (row) => userTypeLabel(row.user_type),
    },
    {
      field: 'linked_companies',
      label: 'Customers',
      labelFor: (row) => linkedCompaniesColumnHeader(row.user_type),
      valueFor: (row) => linkedCompaniesDisplay(row),
    },
    {
      field: 'is_active',
      label: 'Active',
      valueFor: (row) => activeLabel(row.is_active),
    },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'profile_name', label: 'Profile name' },
    { field: 'user_type', label: 'User type' },
    { field: 'is_active', label: 'Active' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rateCards = signal<RateCardRow[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<RateCardsListMeta | null>(null);

  protected readonly columnDefs: ColDef<RateCardRow>[] = [
    {
      field: 'profile_name',
      headerName: 'Profile name',
      flex: 1.4,
      minWidth: 180,
      sort: DEFAULT_DIRECTION,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'user_type',
      headerName: 'User type',
      flex: 0.9,
      minWidth: 120,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueFormatter: (params) => userTypeLabel(params.value as RateCardUserType | undefined),
      filterValueGetter: (params) => userTypeLabel(params.data?.user_type),
    },
    {
      colId: 'linked_companies',
      headerName: 'Customers / providers',
      flex: 1.2,
      minWidth: 160,
      sortable: false,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueGetter: (params) => linkedCompaniesDisplay(params.data),
      filterValueGetter: (params) => linkedCompaniesFilterText(params.data),
      cellClass: 'rate-cards-grid__linked-cell',
      autoHeight: true,
      wrapText: true,
    },
    {
      field: 'is_active',
      headerName: 'Active',
      flex: 0.6,
      minWidth: 90,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueFormatter: (params) => activeLabel(params.value as boolean | undefined),
      filterValueGetter: (params) => activeLabel(params.data?.is_active),
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
      cellClass: 'rate-cards-grid__actions-cell',
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
        switchMap(() =>
          this.rateCardsApi.list<RateCardsListResponse>(this.buildParams()).pipe(
            catchError(() => {
              const lastGood = this.meta();
              if (lastGood) {
                this.page.set(lastGood.current_page);
                if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                  this.pageSize.set(lastGood.per_page as PageSize);
                }
              }
              this.error.set('Unable to load rate cards. Please try again.');
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
        this.rateCards.set(res.rate_cards);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
        queueMicrotask(() => this.gridApi?.resetRowHeights());
      });

    this.loadRateCards();
  }

  protected onGridReady(event: GridReadyEvent<RateCardRow>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<RateCardRow>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadRateCards();
  }

  protected onSortChanged(event: SortChangedEvent<RateCardRow>): void {
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
    this.loadRateCards();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadRateCards();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadRateCards();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadRateCards();
  }

  protected actionsForList = (_data: RateCardRow): DataListAction<RateCardRow>[] => [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'primary',
      run: (row) => {
        void this.router.navigateByUrl(`/app/rate-cards/${row.id}/edit`);
      },
    },
  ];

  protected onPageSizeChange(value: number): void {
    const next = value as PageSize;
    if (!PAGE_SIZE_OPTIONS.includes(next) || next === this.pageSize()) {
      return;
    }
    this.pageSize.set(next);
    this.page.set(1);
    this.loadRateCards();
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadRateCards();
  }

  private actionsFor(data: AddressActionsCellRow): AddressActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => {
          void this.router.navigateByUrl(`/app/rate-cards/${data.id}/edit`);
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
      if (!model || !this.isTextFilterModel(model) || !model.type) {
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

  private isTextFilterModel(
    model: FilterModel[string] | null | undefined,
  ): model is TextFilterModel {
    if (!model || typeof model !== 'object' || !('type' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'text';
    return filterType === 'text' || filterType == null;
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

  private loadRateCards(): void {
    this.load$.next();
  }
}

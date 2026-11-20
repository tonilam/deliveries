import { HttpClient, HttpParams } from '@angular/common/http';
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
import { Company } from '../../../core/company/company.model';
import {
  CompanyActionItem,
  CompanyActionsCell,
  CompanyActionsCellRow,
} from './company-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = ['business_name', 'reg_number', 'email', 'allowed_domains'] as const;
const SORTABLE_FIELDS = FILTERABLE_FIELDS;
type SortableField = (typeof SORTABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'business_name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

/** Keep row order as returned by the server (pagination is server-side). */
const serverSideSortComparator = (): number => 0;

interface CompaniesListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface CompaniesListResponse {
  companies: Company[];
  meta: CompaniesListMeta;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  // Compound AND/OR conditions are not serialized to the list API yet.
  maxNumConditions: 1,
  // Filtering is applied on the server; keep every loaded row visible.
  textMatcher: () => true,
};

@Component({
  selector: 'app-admin-companies',
  imports: [AgGridAngular, DataListComponent, FormsModule, RouterLink],
  templateUrl: './companies.html',
  styleUrls: ['../../../shared/portal-shell.scss', './companies.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCompanies implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<Company> | null = null;
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
      this.loadCompanies();
    });
  }

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly companyListTitle = (row: Company): string => row.business_name;

  protected readonly listColumns: DataListColumn<Company>[] = [
    { field: 'reg_number', label: 'Reg number' },
    { field: 'email', label: 'Email' },
    {
      field: 'allowed_domains',
      label: 'Allowed domains',
      valueFor: (row) => row.allowed_domains.join(', '),
    },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'business_name', label: 'Business name' },
    { field: 'reg_number', label: 'Reg number' },
    { field: 'email', label: 'Email' },
    { field: 'allowed_domains', label: 'Allowed domains' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly companies = signal<Company[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<CompaniesListMeta | null>(null);

  protected readonly columnDefs: ColDef<Company>[] = [
    {
      field: 'business_name',
      headerName: 'Business name',
      flex: 1.2,
      minWidth: 180,
      sort: DEFAULT_DIRECTION,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'reg_number',
      headerName: 'Reg number',
      flex: 0.9,
      minWidth: 130,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.2,
      minWidth: 180,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'allowed_domains',
      headerName: 'Allowed domains',
      flex: 1.2,
      minWidth: 160,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueFormatter: (params) => (Array.isArray(params.value) ? params.value.join(', ') : ''),
      filterValueGetter: (params) =>
        Array.isArray(params.data?.allowed_domains) ? params.data.allowed_domains.join(', ') : '',
    },
    {
      headerName: 'Actions',
      flex: 0.9,
      minWidth: 140,
      sortable: false,
      filter: false,
      floatingFilter: false,
      cellClass: 'users-grid__actions-cell',
      cellRenderer: CompanyActionsCell,
      cellRendererParams: {
        actionsFor: (data: CompanyActionsCellRow) => this.actionsFor(data),
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
          return this.http
            .get<CompaniesListResponse>('/api/admin/companies', {
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
                this.error.set('Unable to load companies. Please try again.');
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
        this.companies.set(res.companies);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadCompanies();
  }

  protected onGridReady(event: GridReadyEvent<Company>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<Company>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadCompanies();
  }

  protected onSortChanged(event: SortChangedEvent<Company>): void {
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
    this.loadCompanies();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadCompanies();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadCompanies();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadCompanies();
  }

  protected actionsForList = (row: Company): DataListAction<Company>[] => {
    return [
      {
        id: 'edit',
        label: 'Edit',
        variant: 'primary',
        run: (data) => {
          void this.router.navigateByUrl(`/admin/companies/${data.id}/edit`);
        },
      },
      {
        id: 'add-customer',
        label: 'Add customer',
        variant: 'ghost',
        run: (data) => {
          void this.router.navigate(['/admin/users/create'], {
            queryParams: { role: 'customer', company_id: data.id },
          });
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
    this.loadCompanies();
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadCompanies();
  }

  private actionsFor(data: CompanyActionsCellRow): CompanyActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => {
          void this.router.navigateByUrl(`/admin/companies/${data.id}/edit`);
        },
      },
      {
        id: 'add-customer',
        label: 'Add customer',
        run: () => {
          void this.router.navigate(['/admin/users/create'], {
            queryParams: { role: 'customer', company_id: data.id },
          });
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
      if (!this.isTextFilterModel(model) || !model.type) {
        continue;
      }

      const isBlankType = model.type === 'blank' || model.type === 'notBlank';
      const filterText = model.filter?.trim() ?? '';
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
    return (SORTABLE_FIELDS as readonly string[]).includes(field);
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

  private loadCompanies(): void {
    this.load$.next();
  }
}

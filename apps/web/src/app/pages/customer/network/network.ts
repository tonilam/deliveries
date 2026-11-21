import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
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
  ITextFilterParams,
  ModuleRegistry,
  SortChangedEvent,
  TextFilterModel,
  themeQuartz,
} from 'ag-grid-community';
import { AuthService } from '../../../core/auth/auth.service';
import { Company, CompanyType } from '../../../core/company/company.model';
import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../shared/data-list/data-list.types';
import {
  CompanyActionItem,
  CompanyActionsCellRow,
  NetworkActionsCell,
} from './network-actions-cell';
import { catchError, of, Subject, switchMap, tap } from 'rxjs';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type NetworkSegment = 'customers' | 'providers';
type NetworkApiType = 'customer' | 'provider';

const FILTERABLE_FIELDS = ['business_name', 'reg_number', 'email', 'allowed_domains'] as const;
const SORTABLE_FIELDS = FILTERABLE_FIELDS;
type SortableField = (typeof SORTABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'business_name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

const serverSideSortComparator = (): number => 0;

interface NetworkListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface NetworkListResponse {
  companies: Company[];
  own_company_type: CompanyType;
  meta: NetworkListMeta;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

@Component({
  selector: 'app-customer-network',
  imports: [AgGridAngular, DataListComponent, FormsModule, RouterLink],
  templateUrl: './network.html',
  styleUrls: ['../../../shared/portal-shell.scss', './network.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerNetwork implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<Company> | null = null;
  private suppressGridEvents = false;
  private lastCompactView: boolean | null = null;
  private filterModel: FilterModel = {};

  protected readonly segment = signal<NetworkSegment>('providers');
  protected readonly ownCompanyType = signal<CompanyType | null>(null);
  protected readonly deleteTarget = signal<Company | null>(null);
  protected readonly deleting = signal(false);

  protected readonly showCustomersTab = computed(() => {
    const type = this.ownCompanyType();
    return type === null || type === 'provider' || type === 'broker';
  });

  protected readonly showProvidersTab = computed(() => {
    const type = this.ownCompanyType();
    return type === null || type === 'customer' || type === 'broker';
  });

  protected readonly networkApiType = computed((): NetworkApiType =>
    this.segment() === 'customers' ? 'customer' : 'provider',
  );

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
  protected readonly meta = signal<NetworkListMeta | null>(null);

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
      flex: 0,
      width: 100,
      minWidth: 100,
      maxWidth: 100,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      suppressSizeToFit: true,
      cellClass: 'users-grid__actions-cell',
      cellRenderer: NetworkActionsCell,
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
    this.route.paramMap.subscribe((params) => {
      const raw = params.get('segment');
      const segment: NetworkSegment = raw === 'customers' ? 'customers' : 'providers';
      this.segment.set(segment);
      this.page.set(1);
      this.loadCompanies();
    });

    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http
            .get<NetworkListResponse>('/api/network/companies', { params: this.buildParams() })
            .pipe(
              catchError(() => {
                const lastGood = this.meta();
                if (lastGood) {
                  this.page.set(lastGood.current_page);
                  if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                    this.pageSize.set(lastGood.per_page as PageSize);
                  }
                }
                this.error.set('Unable to load network companies. Please try again.');
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
        this.ownCompanyType.set(res.own_company_type);
        this.redirectIfSegmentHidden();
        this.companies.set(res.companies);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });
  }

  protected selectTab(segment: NetworkSegment): void {
    if (segment === this.segment()) {
      return;
    }
    void this.router.navigateByUrl(`/app/network/${segment}`);
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
          void this.router.navigateByUrl(`/app/network/${this.segment()}/${data.id}/edit`);
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'ghost',
        run: (data) => this.openDelete(data),
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

  protected openDelete(company: Company): void {
    this.deleteTarget.set(company);
  }

  protected cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.delete(`/api/network/companies/${target.id}`)))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteTarget.set(null);
          this.loadCompanies();
        },
        error: (err: { error?: { message?: string } }) => {
          this.deleting.set(false);
          this.error.set(err.error?.message ?? 'Could not delete company.');
          this.deleteTarget.set(null);
        },
      });
  }

  private actionsFor(data: CompanyActionsCellRow): CompanyActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => {
          void this.router.navigateByUrl(`/app/network/${this.segment()}/${data.id}/edit`);
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        run: () => {
          const row = this.companies().find((c) => c.id === data.id);
          if (row) {
            this.openDelete(row);
          }
        },
      },
    ];
  }

  private redirectIfSegmentHidden(): void {
    const segment = this.segment();
    if (segment === 'customers' && !this.showCustomersTab()) {
      void this.router.navigateByUrl('/app/network/providers');
    }
    if (segment === 'providers' && !this.showProvidersTab()) {
      void this.router.navigateByUrl('/app/network/customers');
    }
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('network_type', this.networkApiType())
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

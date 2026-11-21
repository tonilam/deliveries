import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { Company, CompanyType } from '../../../core/company/company.model';
import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import { DataListColumn, DataListSortOption } from '../../../shared/data-list/data-list.types';

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
const CANDIDATE_SEARCH_DEBOUNCE_MS = 300;
const CANDIDATE_SEARCH_MIN_CHARS = 2;

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
  parent_company_type: CompanyType;
  meta: NetworkListMeta;
}

interface NetworkCandidate {
  id: number;
  business_name: string;
  reg_number: string;
  email: string;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

@Component({
  selector: 'app-admin-company-network',
  imports: [AgGridAngular, DataListComponent, FormsModule],
  templateUrl: './company-network.html',
  styleUrls: ['./company-network.scss', '../../../shared/portal-shell.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCompanyNetwork implements OnInit {
  readonly parentCompanyId = input.required<number>();
  readonly parentCompanyType = input.required<CompanyType>();

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly load$ = new Subject<void>();
  private readonly candidateSearch$ = new Subject<string>();
  private gridApi: GridApi<Company> | null = null;
  private suppressGridEvents = false;
  private lastCompactView: boolean | null = null;
  private filterModel: FilterModel = {};
  private candidateSearchGeneration = 0;

  protected readonly segment = signal<NetworkSegment>('providers');
  protected readonly addModalOpen = signal(false);
  protected readonly candidateQuery = signal('');
  protected readonly candidateSuggestions = signal<NetworkCandidate[]>([]);
  protected readonly candidatesLoading = signal(false);
  protected readonly linking = signal(false);
  protected readonly linkError = signal<string | null>(null);

  protected readonly showCustomersTab = computed(() => {
    const type = this.parentCompanyType();
    return type === 'provider' || type === 'broker';
  });

  protected readonly showProvidersTab = computed(() => {
    const type = this.parentCompanyType();
    return type === 'customer' || type === 'broker';
  });

  protected readonly showNetworkSubTabs = computed(
    () => this.showCustomersTab() && this.showProvidersTab(),
  );

  protected readonly networkApiType = computed((): NetworkApiType =>
    this.segment() === 'customers' ? 'customer' : 'provider',
  );

  protected readonly addButtonLabel = computed(() =>
    this.networkApiType() === 'customer' ? 'Add existing customer' : 'Add existing provider',
  );

  constructor() {
    effect(() => {
      const type = this.parentCompanyType();
      if (type === 'customer') {
        this.segment.set('providers');
      } else if (type === 'provider') {
        this.segment.set('customers');
      }
    });

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
  protected readonly emptyActions = (): [] => [];

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
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    sortingOrder: ['asc', 'desc'],
  };

  ngOnInit(): void {
    this.setupCandidateSearch();

    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http
            .get<NetworkListResponse>(`/api/admin/companies/${this.parentCompanyId()}/network`, {
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
                this.error.set('Unable to load network companies. Please try again.');
                this.loading.set(false);
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
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

  protected selectSegment(segment: NetworkSegment): void {
    if (segment === this.segment()) {
      return;
    }
    this.segment.set(segment);
    this.page.set(1);
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

  protected openAddModal(): void {
    this.candidateQuery.set('');
    this.candidateSuggestions.set([]);
    this.linkError.set(null);
    this.addModalOpen.set(true);
  }

  protected closeAddModal(): void {
    if (this.linking()) {
      return;
    }
    this.addModalOpen.set(false);
    this.linkError.set(null);
  }

  protected onCandidateQueryInput(value: string): void {
    this.candidateQuery.set(value);
    this.candidateSearch$.next(value);
  }

  protected linkCandidate(candidate: NetworkCandidate): void {
    if (this.linking()) {
      return;
    }

    this.linking.set(true);
    this.linkError.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<{ company: Company }>(
            `/api/admin/companies/${this.parentCompanyId()}/network`,
            { company_id: candidate.id },
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.linking.set(false);
          this.addModalOpen.set(false);
          this.loadCompanies();
          this.toastr.success('Company linked to network.');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.linking.set(false);
          const message =
            err.error?.errors?.['company_id']?.[0] ??
            err.error?.message ??
            'Could not link company.';
          this.linkError.set(message);
          this.toastr.error(message);
        },
      });
  }

  private setupCandidateSearch(): void {
    this.candidateSearch$
      .pipe(
        debounceTime(CANDIDATE_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((query) => {
          const generation = ++this.candidateSearchGeneration;
          const trimmed = query.trim();

          if (trimmed.length < CANDIDATE_SEARCH_MIN_CHARS) {
            this.candidateSuggestions.set([]);
            this.candidatesLoading.set(false);
            return of({ generation, companies: [] as NetworkCandidate[] });
          }

          this.candidatesLoading.set(true);
          const params = new HttpParams().set('type', this.networkApiType()).set('search', trimmed);

          return this.http
            .get<{ companies: NetworkCandidate[] }>(
              `/api/admin/companies/${this.parentCompanyId()}/network/candidates`,
              { params },
            )
            .pipe(
              map((res) => ({ generation, companies: res.companies })),
              catchError(() => of({ generation, companies: [] as NetworkCandidate[] })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ generation, companies }) => {
        if (generation !== this.candidateSearchGeneration) {
          return;
        }
        this.candidateSuggestions.set(companies);
        this.candidatesLoading.set(false);
      });
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('type', this.networkApiType())
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

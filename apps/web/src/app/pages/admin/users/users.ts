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
import { catchError, of, Subject, switchMap, tap } from 'rxjs';

import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../shared/data-list/data-list.types';
import { AuthService } from '../../../core/auth/auth.service';
import { UserActionItem, UserActionsCell, UserActionsCellRow } from './user-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

export type UsersTab = 'admin' | 'customer';

export interface ManagedUserRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  has_password: boolean;
  company: string | null;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const ADMIN_FILTERABLE_FIELDS = ['name', 'email', 'is_active'] as const;
const CUSTOMER_FILTERABLE_FIELDS = ['name', 'company', 'email', 'is_active'] as const;
type AdminSortableField = (typeof ADMIN_FILTERABLE_FIELDS)[number];
type CustomerSortableField = (typeof CUSTOMER_FILTERABLE_FIELDS)[number];
type SortableField = AdminSortableField | CustomerSortableField;
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

/** Keep row order as returned by the server (pagination is server-side). */
const serverSideSortComparator = (): number => 0;

interface UsersListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface UsersListResponse {
  users: ManagedUserRow[];
  meta: UsersListMeta;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

function activeLabel(isActive: boolean): string {
  return isActive ? 'Yes' : 'No';
}

@Component({
  selector: 'app-admin-users',
  imports: [AgGridAngular, DataListComponent, FormsModule, RouterLink],
  templateUrl: './users.html',
  styleUrls: ['../../../shared/portal-shell.scss', './users.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly load$ = new Subject<void>();
  private filterModel: FilterModel = {};
  private lastCompactView: boolean | null = null;
  private gridApi: GridApi<ManagedUserRow> | null = null;
  private suppressGridEvents = false;

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
      this.loadUsers();
    });
  }

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly userListTitle = (row: ManagedUserRow): string => row.name;

  protected readonly listColumns = computed(() => this.buildListColumns(this.activeTab()));
  protected readonly sortOptions = computed(() => this.buildSortOptions(this.activeTab()));
  protected readonly listSearchPlaceholder = computed(() =>
    this.activeTab() === 'customer' ? 'Search customer users…' : 'Search admin users…',
  );

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly activeTab = signal<UsersTab>('admin');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly inviteNotice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly users = signal<ManagedUserRow[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<UsersListMeta | null>(null);
  protected readonly columnDefs = signal<ColDef<ManagedUserRow>[]>(this.buildColumnDefs('admin'));

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    sortingOrder: ['asc', 'desc'],
  };

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'admin' || tab === 'customer') {
      this.activeTab.set(tab);
      this.columnDefs.set(this.buildColumnDefs(tab));
    }

    const invited = this.route.snapshot.queryParamMap.get('invited');
    const passwordReset = this.route.snapshot.queryParamMap.get('passwordReset');
    if (invited && passwordReset) {
      this.inviteNotice.set(
        `Invitation sent to ${invited}. Password updated for ${passwordReset}.`,
      );
    } else if (invited) {
      this.inviteNotice.set(`Invitation sent to ${invited}.`);
    } else if (passwordReset) {
      this.inviteNotice.set(`Password updated for ${passwordReset}.`);
    }

    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() => {
          return this.http
            .get<UsersListResponse>('/api/admin/users', {
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
                this.error.set('Unable to load users. Please try again.');
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
        this.users.set(res.users);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadUsers();
  }

  protected onGridReady(event: GridReadyEvent<ManagedUserRow>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected selectTab(tab: UsersTab): void {
    if (tab === this.activeTab()) {
      return;
    }

    this.activeTab.set(tab);
    this.actionError.set(null);
    this.filterModel = {};
    this.searchQuery.set('');
    this.sortField = DEFAULT_SORT;
    this.sortDirection = DEFAULT_DIRECTION;
    this.page.set(1);
    this.columnDefs.set(this.buildColumnDefs(tab));

    if (!this.compact()) {
      this.suppressGridEvents = true;
      this.gridApi?.setFilterModel(null);
      this.gridApi?.applyColumnState({
        defaultState: { sort: null },
        state: [{ colId: DEFAULT_SORT, sort: DEFAULT_DIRECTION }],
      });
      queueMicrotask(() => {
        this.suppressGridEvents = false;
      });
    } else {
      this.gridApi = null;
    }

    this.loadUsers();
  }

  protected onFilterChanged(event: FilterChangedEvent<ManagedUserRow>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadUsers();
  }

  protected onSortChanged(event: SortChangedEvent<ManagedUserRow>): void {
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
    this.loadUsers();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadUsers();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadUsers();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadUsers();
  }

  protected actionsForList = (row: ManagedUserRow): DataListAction<ManagedUserRow>[] => {
    return this.actionsFor(row).map((action) => ({
      id: action.id,
      label: action.label,
      variant: action.id === 'impersonate' ? 'primary' : 'ghost',
      run: () => action.run(),
    }));
  };

  protected onPageSizeChange(value: number): void {
    const next = value as PageSize;
    if (!PAGE_SIZE_OPTIONS.includes(next) || next === this.pageSize()) {
      return;
    }
    this.pageSize.set(next);
    this.page.set(1);
    this.loadUsers();
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadUsers();
  }

  private buildColumnDefs(tab: UsersTab): ColDef<ManagedUserRow>[] {
    const cols: ColDef<ManagedUserRow>[] = [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        sort: DEFAULT_DIRECTION,
        comparator: serverSideSortComparator,
        filter: 'agTextColumnFilter',
        filterParams: serverSideTextFilterParams,
      },
    ];

    if (tab === 'customer') {
      cols.push({
        field: 'company',
        headerName: 'Company',
        flex: 1,
        minWidth: 160,
        comparator: serverSideSortComparator,
        filter: 'agTextColumnFilter',
        filterParams: serverSideTextFilterParams,
        valueFormatter: (params) => params.value ?? '',
      });
    }

    cols.push(
      {
        field: 'email',
        headerName: 'Email',
        flex: 1.4,
        minWidth: 200,
        comparator: serverSideSortComparator,
        filter: 'agTextColumnFilter',
        filterParams: serverSideTextFilterParams,
      },
      {
        field: 'is_active',
        headerName: 'Active',
        flex: 0.6,
        minWidth: 100,
        comparator: serverSideSortComparator,
        filter: 'agTextColumnFilter',
        filterParams: serverSideTextFilterParams,
        valueFormatter: (params) => (params.value ? 'Yes' : 'No'),
        filterValueGetter: (params) => (params.data?.is_active ? 'Yes' : 'No'),
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
        cellRenderer: UserActionsCell,
        cellRendererParams: {
          actionsFor: (data: UserActionsCellRow) => this.actionsFor(data),
        },
      },
    );

    return cols;
  }

  private buildListColumns(tab: UsersTab): DataListColumn<ManagedUserRow>[] {
    const cols: DataListColumn<ManagedUserRow>[] = [];

    if (tab === 'customer') {
      cols.push({
        field: 'company',
        label: 'Company',
        valueFor: (row) => row.company ?? '',
      });
    }

    cols.push(
      { field: 'email', label: 'Email' },
      {
        field: 'is_active',
        label: 'Active',
        valueFor: (row) => activeLabel(row.is_active),
      },
    );

    return cols;
  }

  private buildSortOptions(tab: UsersTab): DataListSortOption[] {
    const options: DataListSortOption[] = [{ field: 'name', label: 'Name' }];

    if (tab === 'customer') {
      options.push({ field: 'company', label: 'Company' });
    }

    options.push({ field: 'email', label: 'Email' }, { field: 'is_active', label: 'Active' });

    return options;
  }

  private actionsFor(data: UserActionsCellRow): UserActionItem[] {
    const actions: UserActionItem[] = [];

    if (this.activeTab() === 'customer' && data.is_active) {
      actions.push({
        id: 'impersonate',
        label: 'Impersonate',
        run: () => this.impersonate(data),
      });
    }

    if (data.has_password) {
      actions.push({
        id: 'reset-password',
        label: 'Reset password',
        run: () => {
          void this.router.navigateByUrl(`/admin/users/${data.id}/reset-password`);
        },
      });
    }

    return actions;
  }

  private impersonate(data: UserActionsCellRow): void {
    this.actionError.set(null);
    this.auth.impersonate(data.id).subscribe({
      next: (user) => {
        void this.router.navigateByUrl(this.auth.homePathFor(user));
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        const first = err.error?.errors?.['user']?.[0] ?? err.error?.message;
        this.actionError.set(first ?? 'Unable to impersonate this user.');
      },
    });
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('role', this.activeTab())
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

    for (const field of this.filterableFields()) {
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

  private filterableFields(): readonly SortableField[] {
    return this.activeTab() === 'customer' ? CUSTOMER_FILTERABLE_FIELDS : ADMIN_FILTERABLE_FIELDS;
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
    return (this.filterableFields() as readonly string[]).includes(field);
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

  private loadUsers(): void {
    this.load$.next();
  }
}

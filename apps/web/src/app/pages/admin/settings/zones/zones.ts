import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

import { AuthService } from '../../../../core/auth/auth.service';
import { Country } from '../../../../core/country/country.model';
import { Zone } from '../../../../core/zone/zone.model';
import { createCompactViewportSignal } from '../../../../shared/compact-viewport';
import { DataListComponent } from '../../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../../shared/data-list/data-list.types';
import { BooleanCheckboxCell } from '../../../../shared/ag-grid/boolean-checkbox-cell';
import {
  VehicleCategoryActionItem,
  VehicleCategoryActionsCell,
  VehicleCategoryActionsCellRow,
} from '../../vehicles/vehicle-category-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = ['name', 'code', 'country', 'is_active'] as const;
const SORTABLE_FIELDS = FILTERABLE_FIELDS;
type SortableField = (typeof SORTABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

const serverSideSortComparator = (): number => 0;

interface ZonesListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface ZonesListResponse {
  zones: Zone[];
  meta: ZonesListMeta;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

function countryName(zone: Zone): string {
  return zone.country?.name ?? '';
}

@Component({
  selector: 'app-admin-zones',
  imports: [
    AgGridAngular,
    DataListComponent,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    BooleanCheckboxCell,
  ],
  templateUrl: './zones.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './zones.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminZones implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<Zone> | null = null;
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
      this.loadZones();
    });
  }

  private readonly fb = inject(FormBuilder);

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly zoneListTitle = (row: Zone): string => row.name;

  protected readonly listColumns: DataListColumn<Zone>[] = [
    { field: 'code', label: 'Code' },
    { field: 'country', label: 'Country', valueFor: countryName },
    { field: 'is_active', label: 'Active', booleanCheckbox: true },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'name', label: 'Name' },
    { field: 'code', label: 'Code' },
    { field: 'country', label: 'Country' },
    { field: 'is_active', label: 'Active' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly zones = signal<Zone[]>([]);
  protected readonly countries = signal<Country[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<ZonesListMeta | null>(null);

  protected readonly editOpen = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly deleting = signal(false);
  protected readonly pendingDelete = signal<Zone | null>(null);

  protected readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: [
      '',
      [Validators.required, Validators.maxLength(10), Validators.pattern(/^[A-Za-z0-9]+$/)],
    ],
    country_id: [0, [Validators.required, Validators.min(1)]],
    is_active: [true],
  });

  protected readonly columnDefs: ColDef<Zone>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.2,
      minWidth: 160,
      sort: DEFAULT_DIRECTION,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'code',
      headerName: 'Code',
      flex: 0.6,
      minWidth: 90,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      colId: 'country',
      headerName: 'Country',
      flex: 1,
      minWidth: 140,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueGetter: (params) => countryName(params.data ?? ({} as Zone)),
      filterValueGetter: (params) => countryName(params.data ?? ({} as Zone)),
    },
    {
      field: 'is_active',
      headerName: 'Active',
      flex: 0.5,
      minWidth: 90,
      maxWidth: 100,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      cellRenderer: BooleanCheckboxCell,
      cellClass: 'users-grid__checkbox-cell',
      filterValueGetter: (params) =>
        params.data?.is_active ? 'Yes' : params.data?.is_active === false ? 'No' : '',
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
      cellRenderer: VehicleCategoryActionsCell,
      cellRendererParams: {
        actionsFor: (data: VehicleCategoryActionsCellRow) => this.actionsFor(data),
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
    this.http.get<{ countries: Country[] }>('/api/admin/countries').subscribe({
      next: (res) => this.countries.set(res.countries),
    });

    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http.get<ZonesListResponse>('/api/admin/zones', { params: this.buildParams() }).pipe(
            catchError(() => {
              const lastGood = this.meta();
              if (lastGood) {
                this.page.set(lastGood.current_page);
                if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                  this.pageSize.set(lastGood.per_page as PageSize);
                }
              }
              this.error.set('Unable to load zones. Please try again.');
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
        this.zones.set(res.zones);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadZones();
  }

  protected openEdit(zone: Zone): void {
    this.editError.set(null);
    this.editingId.set(zone.id);
    this.editForm.reset({
      name: zone.name,
      code: zone.code,
      country_id: zone.country_id,
      is_active: zone.is_active,
    });
    this.editOpen.set(true);
  }

  protected cancelEdit(): void {
    if (!this.saving()) {
      this.editOpen.set(false);
      this.editingId.set(null);
      this.editError.set(null);
    }
  }

  protected saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    if (id === null || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.editError.set(null);

    const raw = this.editForm.getRawValue();
    const payload = {
      name: raw.name.trim(),
      code: raw.code.trim().toUpperCase(),
      country_id: raw.country_id,
      is_active: raw.is_active,
    };

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.put(`/api/admin/zones/${id}`, payload)))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editOpen.set(false);
          this.editingId.set(null);
          this.loadZones();
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.editError.set(this.firstError(err) ?? 'Unable to save zone.');
          this.saving.set(false);
        },
      });
  }

  protected requestDelete(zone: Zone): void {
    this.pendingDelete.set(zone);
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const zone = this.pendingDelete();
    if (!zone || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.delete(`/api/admin/zones/${zone.id}`)))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.loadZones();
        },
        error: () => {
          this.deleting.set(false);
          this.error.set('Unable to delete zone.');
          this.pendingDelete.set(null);
        },
      });
  }

  protected onGridReady(event: GridReadyEvent<Zone>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<Zone>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadZones();
  }

  protected onSortChanged(event: SortChangedEvent<Zone>): void {
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
    this.loadZones();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadZones();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadZones();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadZones();
  }

  protected actionsForList = (row: Zone): DataListAction<Zone>[] => {
    return [
      { id: 'edit', label: 'Edit', variant: 'primary', run: (data) => this.openEdit(data) },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'ghost',
        run: (data) => this.requestDelete(data),
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
    this.loadZones();
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadZones();
  }

  private actionsFor(data: VehicleCategoryActionsCellRow): VehicleCategoryActionItem[] {
    const zone = this.zones().find((z) => z.id === data.id);
    if (!zone) {
      return [];
    }

    return [
      { id: 'edit', label: 'Edit', run: () => this.openEdit(zone) },
      { id: 'delete', label: 'Delete', danger: true, run: () => this.requestDelete(zone) },
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
      let filterText = model.filter?.trim() ?? '';
      if (field === 'is_active') {
        if (filterText.toLowerCase() === 'yes') {
          filterText = 'true';
        } else if (filterText.toLowerCase() === 'no') {
          filterText = 'false';
        }
      }
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

  private loadZones(): void {
    this.load$.next();
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return (
      errors?.['name']?.[0] ??
      errors?.['code']?.[0] ??
      errors?.['country_id']?.[0] ??
      err.error?.message
    );
  }
}

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
  SetFilterModel,
  TextFilterModel,
  themeQuartz,
} from 'ag-grid-community';
import { catchError, of, Subject, switchMap, tap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastrService } from '../../../../core/feedback/toastr.service';
import { GoodType, GoodTypeUpdatePayload } from '../../../../core/good-type/good-type.model';
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
import {
  REFRIGERATED_FILTER_LABELS,
  RefrigeratedRequiredFilter,
} from './refrigerated-required-filter';
import { RefrigeratedRequiredFloatingFilter } from './refrigerated-required-floating-filter';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = ['code', 'name', 'refrigerated_required'] as const;
const SORTABLE_FIELDS = FILTERABLE_FIELDS;
type SortableField = (typeof SORTABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'name';
const DEFAULT_DIRECTION: SortDirection = 'asc';

const serverSideSortComparator = (): number => 0;

interface GoodTypesListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface GoodTypesListResponse {
  good_types: GoodType[];
  meta: GoodTypesListMeta;
}

type GoodTypeListRow = GoodType & { id: string };

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

@Component({
  selector: 'app-admin-goods',
  imports: [
    AgGridAngular,
    DataListComponent,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    BooleanCheckboxCell,
    RefrigeratedRequiredFilter,
    RefrigeratedRequiredFloatingFilter,
  ],
  templateUrl: './goods.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './goods.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminGoods implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<GoodTypeListRow> | null = null;
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
      this.loadGoodTypes();
    });
  }

  private readonly fb = inject(FormBuilder);

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly goodTypeListTitle = (row: GoodTypeListRow): string => row.name;

  protected readonly listColumns: DataListColumn<GoodTypeListRow>[] = [
    { field: 'code', label: 'Code' },
    {
      field: 'refrigerated_required',
      label: 'Refrigerated required',
      booleanCheckbox: true,
    },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'name', label: 'Name' },
    { field: 'code', label: 'Code' },
    { field: 'refrigerated_required', label: 'Refrigerated required' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly goodTypes = signal<GoodTypeListRow[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<GoodTypesListMeta | null>(null);

  protected readonly editOpen = signal(false);
  protected readonly editError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingCode = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly pendingDelete = signal<GoodType | null>(null);

  protected readonly editForm = this.fb.nonNullable.group({
    code: [{ value: '', disabled: true }],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    refrigerated_required: [false],
  });

  protected readonly columnDefs: ColDef<GoodTypeListRow>[] = [
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
      field: 'refrigerated_required',
      headerName: 'Refrigerated required',
      flex: 0.7,
      minWidth: 120,
      maxWidth: 160,
      comparator: serverSideSortComparator,
      filter: RefrigeratedRequiredFilter,
      floatingFilterComponent: RefrigeratedRequiredFloatingFilter,
      suppressHeaderFilterButton: true,
      suppressFloatingFilterButton: true,
      cellRenderer: BooleanCheckboxCell,
      cellClass: 'users-grid__checkbox-cell',
      valueFormatter: (params) => (params.data?.refrigerated_required ? 'Yes' : 'No'),
      filterValueGetter: (params) => (params.data?.refrigerated_required ? 'Yes' : 'No'),
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
    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http
            .get<GoodTypesListResponse>('/api/admin/good-types', { params: this.buildParams() })
            .pipe(
              catchError(() => {
                const lastGood = this.meta();
                if (lastGood) {
                  this.page.set(lastGood.current_page);
                  if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                    this.pageSize.set(lastGood.per_page as PageSize);
                  }
                }
                this.error.set('Unable to load goods types. Please try again.');
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
        this.goodTypes.set(res.good_types.map((row) => ({ ...row, id: row.code })));
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadGoodTypes();
  }

  protected openEdit(goodType: GoodType): void {
    this.editError.set(null);
    this.editingCode.set(goodType.code);
    this.editForm.reset({
      code: goodType.code,
      name: goodType.name,
      refrigerated_required: goodType.refrigerated_required,
    });
    this.editOpen.set(true);
  }

  protected cancelEdit(): void {
    if (!this.saving()) {
      this.editOpen.set(false);
      this.editingCode.set(null);
      this.editError.set(null);
    }
  }

  protected saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const code = this.editingCode();
    if (code === null || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.editError.set(null);

    const raw = this.editForm.getRawValue();
    const payload: GoodTypeUpdatePayload = {
      name: raw.name.trim(),
      refrigerated_required: raw.refrigerated_required,
    };

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.put(`/api/admin/good-types/${code}`, payload)))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editOpen.set(false);
          this.editingCode.set(null);
          this.loadGoodTypes();
          this.toastr.success('Goods type updated.');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          const message = this.firstError(err) ?? 'Unable to save goods type.';
          this.editError.set(message);
          this.toastr.error(message);
          this.saving.set(false);
        },
      });
  }

  protected requestDelete(goodType: GoodType): void {
    this.pendingDelete.set(goodType);
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const goodType = this.pendingDelete();
    if (!goodType || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.delete(`/api/admin/good-types/${goodType.code}`)))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.loadGoodTypes();
          this.toastr.success('Goods type deleted.');
        },
        error: () => {
          this.deleting.set(false);
          const message = 'Unable to delete goods type.';
          this.error.set(message);
          this.toastr.error(message);
          this.pendingDelete.set(null);
        },
      });
  }

  protected onGridReady(event: GridReadyEvent<GoodTypeListRow>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<GoodTypeListRow>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadGoodTypes();
  }

  protected onSortChanged(event: SortChangedEvent<GoodTypeListRow>): void {
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
    this.loadGoodTypes();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadGoodTypes();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadGoodTypes();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadGoodTypes();
  }

  protected actionsForList = (row: GoodTypeListRow): DataListAction<GoodTypeListRow>[] => {
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
    this.loadGoodTypes();
  }

  protected goToPage(nextPage: number): void {
    const lastPage = this.meta()?.last_page ?? 1;
    if (nextPage < 1 || nextPage > lastPage || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.loadGoodTypes();
  }

  private actionsFor(data: VehicleCategoryActionsCellRow): VehicleCategoryActionItem[] {
    const goodType = data as unknown as GoodType;
    if (!goodType.code) {
      return [];
    }

    return [
      { id: 'edit', label: 'Edit', run: () => this.openEdit(goodType) },
      { id: 'delete', label: 'Delete', danger: true, run: () => this.requestDelete(goodType) },
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

      if (field === 'refrigerated_required') {
        params = this.appendRefrigeratedSetFilterParams(params, model);
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

  private isTextFilterModel(
    model: FilterModel[string] | null | undefined,
  ): model is TextFilterModel {
    if (!model || typeof model !== 'object' || !('type' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'text';
    return filterType === 'text' || filterType == null;
  }

  private appendRefrigeratedSetFilterParams(
    params: HttpParams,
    model: FilterModel[string],
  ): HttpParams {
    if (!this.isSetFilterModel(model)) {
      return params;
    }

    const selected = (model.values ?? []).filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    if (selected.length === 0) {
      return params
        .set('filter[refrigerated_required][type]', 'equals')
        .set('filter[refrigerated_required][filter]', '__no_match__');
    }

    if (selected.length === 1) {
      return params
        .set('filter[refrigerated_required][type]', 'equals')
        .set('filter[refrigerated_required][filter]', selected[0]);
    }

    if (selected.length >= REFRIGERATED_FILTER_LABELS.length) {
      return params;
    }

    return params;
  }

  private isSetFilterModel(model: FilterModel[string] | null | undefined): model is SetFilterModel {
    if (!model || typeof model !== 'object' || !('values' in model)) {
      return false;
    }
    const filterType = 'filterType' in model ? model.filterType : 'set';
    return filterType === 'set';
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

  private loadGoodTypes(): void {
    this.load$.next();
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return errors?.['name']?.[0] ?? errors?.['refrigerated_required']?.[0] ?? err.error?.message;
  }
}

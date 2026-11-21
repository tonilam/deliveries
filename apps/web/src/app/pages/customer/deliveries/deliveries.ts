import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { ItemActionItem, ItemActionsCell, ItemActionsCellRow } from './item-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

export type ItemDisplayUnit = 'tonnes' | 'kg';

export interface ItemRow {
  id: number;
  good_type_code: string;
  good_type: string;
  weight_tonnes: string;
  display_unit: ItemDisplayUnit;
  order_number: string | null;
  connote: string | null;
}

interface GoodTypeOption {
  code: string;
  name: string;
}

const KG_PER_TONNE = 1000;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = [
  'good_type',
  'weight_tonnes',
  'display_unit',
  'order_number',
  'connote',
] as const;
type SortableField = (typeof FILTERABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'good_type';
const DEFAULT_DIRECTION: SortDirection = 'asc';

const serverSideSortComparator = (): number => 0;

interface ItemsListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface ItemsListResponse {
  items: ItemRow[];
  meta: ItemsListMeta;
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

function displayUnitLabel(unit: ItemDisplayUnit): string {
  return unit === 'kg' ? 'kg' : 'tonnes';
}

function formatWeightForDisplay(tonnes: string, unit: ItemDisplayUnit): string {
  const t = Number.parseFloat(tonnes);
  if (Number.isNaN(t)) {
    return tonnes;
  }
  if (unit === 'kg') {
    const kg = t * KG_PER_TONNE;
    return Number.isInteger(kg) ? String(kg) : kg.toFixed(3).replace(/\.?0+$/, '');
  }
  return tonnes;
}

function weightInputToTonnes(value: number, unit: ItemDisplayUnit): number {
  return unit === 'kg' ? value / KG_PER_TONNE : value;
}

function weightTonnesToInput(tonnes: string, unit: ItemDisplayUnit): number {
  const t = Number.parseFloat(tonnes);
  if (Number.isNaN(t)) {
    return 0;
  }
  return unit === 'kg' ? t * KG_PER_TONNE : t;
}

function weightTonnesAsNumber(tonnes: string | undefined | null): number | null {
  if (tonnes == null || tonnes.trim() === '') {
    return null;
  }
  const value = Number.parseFloat(tonnes);
  return Number.isNaN(value) ? null : value;
}

@Component({
  selector: 'app-customer-deliveries',
  imports: [AgGridAngular, DataListComponent, FormsModule, ReactiveFormsModule, ItemActionsCell],
  templateUrl: './deliveries.html',
  styleUrls: ['../../../shared/portal-shell.scss', './deliveries.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDeliveries implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly fb = inject(FormBuilder);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<ItemRow> | null = null;
  private suppressGridEvents = false;
  private lastCompactView: boolean | null = null;
  private filterModel: FilterModel = {};
  private formDisplayUnit: ItemDisplayUnit = 'tonnes';

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
      this.loadItems();
    });
  }

  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = DEFAULT_DIRECTION;
  protected readonly searchQuery = signal('');

  protected readonly itemListTitle = (row: ItemRow): string => row.good_type;

  protected readonly listColumns: DataListColumn<ItemRow>[] = [
    {
      field: 'weight_tonnes',
      label: 'Weight',
      valueFor: (row) =>
        `${formatWeightForDisplay(row.weight_tonnes, row.display_unit)} ${displayUnitLabel(row.display_unit)}`,
    },
    {
      field: 'display_unit',
      label: 'Display unit',
      valueFor: (row) => displayUnitLabel(row.display_unit),
    },
    {
      field: 'order_number',
      label: 'Order number',
      valueFor: (row) => row.order_number ?? '—',
    },
    { field: 'connote', label: 'Connote', valueFor: (row) => row.connote ?? '—' },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'good_type', label: 'Goods type' },
    { field: 'weight_tonnes', label: 'Weight (tonnes)' },
    { field: 'display_unit', label: 'Display unit' },
    { field: 'order_number', label: 'Order number' },
    { field: 'connote', label: 'Connote' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly items = signal<ItemRow[]>([]);
  protected readonly goodTypeOptions = signal<GoodTypeOption[]>([]);
  protected readonly pendingDelete = signal<ItemActionsCellRow | null>(null);
  protected readonly formModalOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<ItemsListMeta | null>(null);

  protected readonly itemForm = this.fb.nonNullable.group({
    good_type_code: ['', Validators.required],
    weight: [0, [Validators.required, Validators.min(0.000_001)]],
    display_unit: ['tonnes' as ItemDisplayUnit, Validators.required],
    order_number: [''],
    connote: [''],
  });

  protected readonly columnDefs: ColDef<ItemRow>[] = [
    {
      field: 'good_type',
      headerName: 'Goods type',
      flex: 1.1,
      minWidth: 140,
      sort: DEFAULT_DIRECTION,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'weight_tonnes',
      headerName: 'Weight',
      headerTooltip: 'Column filter uses stored tonnes (list values use each row’s display unit).',
      flex: 0.9,
      minWidth: 120,
      comparator: serverSideSortComparator,
      filter: 'agNumberColumnFilter',
      filterParams: serverSideNumberFilterParams,
      filterValueGetter: (params) => weightTonnesAsNumber(params.data?.weight_tonnes),
      valueFormatter: (params) => {
        const row = params.data;
        if (!row) {
          return '';
        }
        return `${formatWeightForDisplay(row.weight_tonnes, row.display_unit)} ${displayUnitLabel(row.display_unit)}`;
      },
    },
    {
      field: 'display_unit',
      headerName: 'Display unit',
      flex: 0.7,
      minWidth: 110,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueFormatter: (params) => displayUnitLabel(params.value as ItemDisplayUnit),
    },
    {
      field: 'order_number',
      headerName: 'Order number',
      flex: 1,
      minWidth: 130,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueFormatter: (params) => params.value ?? '—',
    },
    {
      field: 'connote',
      headerName: 'Connote',
      flex: 1,
      minWidth: 130,
      comparator: serverSideSortComparator,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
      valueFormatter: (params) => params.value ?? '—',
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
      cellClass: 'deliveries-grid__actions-cell',
      cellRenderer: ItemActionsCell,
      cellRendererParams: {
        actionsFor: (data: ItemRow) => this.actionsForRow(data),
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
    this.loadGoodTypeOptions();

    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http.get<ItemsListResponse>('/api/items', { params: this.buildParams() }).pipe(
            catchError(() => {
              const lastGood = this.meta();
              if (lastGood) {
                this.page.set(lastGood.current_page);
                if (PAGE_SIZE_OPTIONS.includes(lastGood.per_page as PageSize)) {
                  this.pageSize.set(lastGood.per_page as PageSize);
                }
              }
              this.error.set('Unable to load items. Please try again.');
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
        this.items.set(res.items);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadItems();
  }

  protected openCreate(): void {
    const options = this.goodTypeOptions();
    if (options.length === 0) {
      this.toastr.error('Goods types are not available yet. Try again in a moment.');
      return;
    }
    this.formError.set(null);
    this.editingId.set(null);
    this.itemForm.reset({
      good_type_code: options[0].code,
      weight: 1,
      display_unit: 'tonnes',
      order_number: '',
      connote: '',
    });
    this.formDisplayUnit = 'tonnes';
    this.formModalOpen.set(true);
  }

  protected openEdit(row: ItemRow): void {
    this.formError.set(null);
    this.editingId.set(row.id);
    this.itemForm.reset({
      good_type_code: row.good_type_code,
      weight: weightTonnesToInput(row.weight_tonnes, row.display_unit),
      display_unit: row.display_unit,
      order_number: row.order_number ?? '',
      connote: row.connote ?? '',
    });
    this.formDisplayUnit = row.display_unit;
    this.ensureGoodTypeOption(row.good_type_code, row.good_type);
    this.formModalOpen.set(true);
  }

  protected cancelFormModal(): void {
    if (!this.saving()) {
      this.formModalOpen.set(false);
      this.editingId.set(null);
      this.formError.set(null);
    }
  }

  protected onDisplayUnitChange(): void {
    const next = this.itemForm.controls.display_unit.value;
    const tonnes = weightInputToTonnes(this.itemForm.controls.weight.value, this.formDisplayUnit);
    this.itemForm.patchValue({
      weight: weightTonnesToInput(String(tonnes), next),
    });
    this.formDisplayUnit = next;
  }

  protected saveItem(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }

    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const raw = this.itemForm.getRawValue();
    const unit = raw.display_unit;
    const weightTonnes = weightInputToTonnes(raw.weight, unit);

    const payload = {
      good_type_code: raw.good_type_code,
      weight_tonnes: weightTonnes,
      display_unit: unit,
      order_number: raw.order_number.trim() === '' ? null : raw.order_number.trim(),
      connote: raw.connote.trim() === '' ? null : raw.connote.trim(),
    };

    const id = this.editingId();
    const request$ =
      id === null
        ? this.http.post<{ item: ItemRow }>('/api/items', payload)
        : this.http.put<{ item: ItemRow }>(`/api/items/${id}`, payload);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.formModalOpen.set(false);
          this.editingId.set(null);
          this.loadItems();
          this.toastr.success(id === null ? 'Item created.' : 'Item updated.');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          const message = this.firstError(err) ?? 'Unable to save item.';
          this.formError.set(message);
          this.toastr.error(message);
          this.saving.set(false);
        },
      });
  }

  protected onGridReady(event: GridReadyEvent<ItemRow>): void {
    this.gridApi = event.api;
    this.syncGridUiFromState();
  }

  protected onFilterChanged(event: FilterChangedEvent<ItemRow>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadItems();
  }

  protected onSortChanged(event: SortChangedEvent<ItemRow>): void {
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
    this.loadItems();
  }

  protected onListSearch(value: string): void {
    if (value === this.searchQuery()) {
      return;
    }
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadItems();
  }

  protected onListSortField(field: string): void {
    if (!this.isSortableField(field) || field === this.sortField) {
      return;
    }
    this.sortField = field;
    this.page.set(1);
    this.loadItems();
  }

  protected onListSortDirection(direction: SortDirection): void {
    if (direction === this.sortDirection) {
      return;
    }
    this.sortDirection = direction;
    this.page.set(1);
    this.loadItems();
  }

  protected actionsForList = (data: ItemRow): DataListAction<ItemRow>[] => {
    return [
      {
        id: 'edit',
        label: 'Edit',
        variant: 'primary',
        run: (row) => this.openEdit(row),
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
    this.loadItems();
  }

  protected requestDelete(row: ItemActionsCellRow): void {
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
      .pipe(switchMap(() => this.http.delete(`/api/items/${pending.id}`)))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.loadItems();
          this.toastr.success('Item deleted.');
        },
        error: () => {
          const message = 'Unable to delete item. Please try again.';
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
    this.loadItems();
  }

  protected readonly isEditMode = () => this.editingId() !== null;

  private loadGoodTypeOptions(): void {
    this.http
      .get<{ good_types: GoodTypeOption[] }>('/api/items/good-type-options')
      .pipe(catchError(() => of({ good_types: [] })))
      .subscribe((res) => this.goodTypeOptions.set(res.good_types));
  }

  private actionsForRow(data: ItemRow): ItemActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => this.openEdit(data),
      },
      {
        id: 'delete',
        label: 'Delete',
        run: () => this.requestDelete(data),
      },
    ];
  }

  private ensureGoodTypeOption(code: string, name: string): void {
    if (this.goodTypeOptions().some((opt) => opt.code === code)) {
      return;
    }
    this.goodTypeOptions.update((opts) => [...opts, { code, name }]);
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

      if (field === 'weight_tonnes') {
        params = this.appendWeightFilterParams(params, model);
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

  private appendWeightFilterParams(params: HttpParams, model: FilterModel[string]): HttpParams {
    if (!this.isNumberFilterModel(model) || !model.type) {
      return params;
    }

    const filterValue = model.filter;
    if (filterValue == null || Number.isNaN(filterValue)) {
      return params;
    }

    params = params
      .set('filter[weight_tonnes][type]', model.type)
      .set('filter[weight_tonnes][filter]', String(filterValue));

    if (model.type === 'inRange' && model.filterTo != null && !Number.isNaN(model.filterTo)) {
      params = params.set('filter[weight_tonnes][filterTo]', String(model.filterTo));
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

  private loadItems(): void {
    this.load$.next();
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | null {
    const errors = err.error?.errors;
    if (errors) {
      const firstKey = Object.keys(errors)[0];
      if (firstKey && errors[firstKey]?.[0]) {
        return errors[firstKey][0];
      }
    }
    if (typeof err.error?.message === 'string') {
      return err.error.message;
    }
    return null;
  }
}

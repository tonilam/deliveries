import { HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
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

import { AdminVehiclesApiService } from '../../../core/admin/admin-vehicles-api.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { VehicleBodyType, VehicleCategory } from '../../../core/vehicle/vehicle.model';
import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../shared/data-list/data-list.types';
import {
  VehicleCategoryActionItem,
  VehicleCategoryActionsCell,
  VehicleCategoryActionsCellRow,
} from './vehicle-category-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const FILTERABLE_FIELDS = ['name', 'code', 'capacity_unit'] as const;
const SORTABLE_FIELDS = [
  'name',
  'code',
  'capacity',
  'capacity_unit',
  'pallet_spaces',
  'payload_kg',
] as const;
type SortableField = (typeof SORTABLE_FIELDS)[number];
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT: SortableField = 'name';

interface ListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

const serverSideTextFilterParams: ITextFilterParams = {
  debounceMs: 300,
  trimInput: true,
  maxNumConditions: 1,
  textMatcher: () => true,
};

@Component({
  selector: 'app-admin-vehicle-body-types',
  imports: [AgGridAngular, DataListComponent, FormsModule, RouterLink],
  templateUrl: './body-types.html',
  styleUrls: ['../../../shared/portal-shell.scss', './vehicles.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminVehicleBodyTypes implements OnInit {
  private readonly vehiclesApi = inject(AdminVehiclesApiService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly load$ = new Subject<void>();
  private gridApi: GridApi<VehicleBodyType> | null = null;
  private suppressGridEvents = false;
  private lastCompactView: boolean | null = null;
  private filterModel: FilterModel = {};

  protected readonly categoryId = signal<number | null>(null);
  protected readonly category = signal<VehicleCategory | null>(null);
  protected readonly compact = createCompactViewportSignal();
  protected sortField: SortableField = DEFAULT_SORT;
  protected sortDirection: SortDirection = 'asc';
  protected readonly searchQuery = signal('');
  protected readonly pendingDelete = signal<VehicleBodyType | null>(null);
  protected readonly deleting = signal(false);

  protected readonly listTitle = (row: VehicleBodyType): string => row.name;

  protected readonly listColumns: DataListColumn<VehicleBodyType>[] = [
    { field: 'code', label: 'Code' },
    {
      field: 'capacity',
      label: 'Capacity',
      valueFor: (row) => `${row.capacity} ${row.capacity_unit}`,
    },
    {
      field: 'payload_kg',
      label: 'Payload (kg)',
      valueFor: (row) => (row.payload_kg != null ? String(row.payload_kg) : '—'),
    },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'name', label: 'Name' },
    { field: 'code', label: 'Code' },
    { field: 'capacity', label: 'Capacity' },
    { field: 'payload_kg', label: 'Payload (kg)' },
  ];

  protected readonly theme = themeQuartz;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<VehicleBodyType[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<PageSize>(25);
  protected readonly meta = signal<ListMeta | null>(null);

  protected readonly columnDefs: ColDef<VehicleBodyType>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.2,
      minWidth: 160,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'code',
      headerName: 'Code',
      flex: 0.8,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    { field: 'capacity', headerName: 'Capacity', flex: 0.7, filter: 'agNumberColumnFilter' },
    {
      field: 'capacity_unit',
      headerName: 'Unit',
      flex: 0.6,
      filter: 'agTextColumnFilter',
      filterParams: serverSideTextFilterParams,
    },
    {
      field: 'pallet_spaces',
      headerName: 'Pallet spaces',
      flex: 0.7,
      filter: 'agNumberColumnFilter',
    },
    { field: 'payload_kg', headerName: 'Payload (kg)', flex: 0.8, filter: 'agNumberColumnFilter' },
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
      cellClass: 'body-types-grid__actions-cell',
      cellRenderer: VehicleCategoryActionsCell,
      cellRendererParams: {
        actionsFor: (data: VehicleCategoryActionsCellRow) => this.gridActionsFor(data),
      },
    },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    floatingFilter: true,
    sortingOrder: ['asc', 'desc'],
  };

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
      this.loadRows();
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('categoryId'));
    if (!Number.isFinite(id)) {
      this.error.set('Invalid category.');
      return;
    }
    this.categoryId.set(id);

    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() => {
          const categoryId = this.categoryId();
          if (categoryId === null) {
            return of(null);
          }
          return this.vehiclesApi
            .listBodyTypes<{
              vehicle_body_types: VehicleBodyType[];
              vehicle_category: VehicleCategory;
              meta: ListMeta;
            }>(categoryId, this.buildParams())
            .pipe(
              catchError(() => {
                this.error.set('Unable to load body types.');
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
        this.rows.set(res.vehicle_body_types);
        this.category.set(res.vehicle_category);
        this.meta.set(res.meta);
        this.page.set(res.meta.current_page);
        this.loading.set(false);
      });

    this.loadRows();
  }

  protected actionsForList = (row: VehicleBodyType): DataListAction<VehicleBodyType>[] => [
    {
      id: 'edit',
      label: 'Edit',
      variant: 'primary',
      run: (data) => void this.navigateEdit(data.id),
    },
    {
      id: 'delete',
      label: 'Delete',
      variant: 'ghost',
      run: (data) => this.pendingDelete.set(data),
    },
  ];

  protected onGridReady(event: GridReadyEvent<VehicleBodyType>): void {
    this.gridApi = event.api;
  }

  protected onFilterChanged(event: FilterChangedEvent<VehicleBodyType>): void {
    if (this.suppressGridEvents || this.compact()) {
      return;
    }
    this.filterModel = event.api.getFilterModel() ?? {};
    this.page.set(1);
    this.loadRows();
  }

  protected onSortChanged(event: SortChangedEvent<VehicleBodyType>): void {
    if (this.suppressGridEvents) {
      return;
    }
    const sorted = event.api
      .getColumnState()
      .find((column) => column.sort === 'asc' || column.sort === 'desc');
    const nextField =
      sorted?.colId && this.isSortableField(sorted.colId) ? sorted.colId : DEFAULT_SORT;
    const nextDirection: SortDirection =
      sorted?.sort === 'asc' || sorted?.sort === 'desc' ? sorted.sort : 'asc';
    this.sortField = nextField;
    this.sortDirection = nextDirection;
    this.page.set(1);
    this.loadRows();
  }

  protected onListSearch(value: string): void {
    this.searchQuery.set(value);
    this.page.set(1);
    this.loadRows();
  }

  protected onListSortField(field: string): void {
    if (this.isSortableField(field)) {
      this.sortField = field;
      this.page.set(1);
      this.loadRows();
    }
  }

  protected onListSortDirection(direction: SortDirection): void {
    this.sortDirection = direction;
    this.page.set(1);
    this.loadRows();
  }

  protected onPageSizeChange(value: number): void {
    this.pageSize.set(value as PageSize);
    this.page.set(1);
    this.loadRows();
  }

  protected goToPage(nextPage: number): void {
    this.page.set(nextPage);
    this.loadRows();
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const row = this.pendingDelete();
    const categoryId = this.categoryId();
    if (!row || !categoryId || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.vehiclesApi.deleteBodyType(categoryId, row.id).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        this.deleting.set(false);
        this.loadRows();
        this.toastr.success('Body type deleted.');
      },
      error: () => {
        const message = 'Unable to delete body type.';
        this.error.set(message);
        this.toastr.error(message);
        this.deleting.set(false);
      },
    });
  }

  private gridActionsFor(data: VehicleCategoryActionsCellRow): VehicleCategoryActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => void this.navigateEdit(data.id),
      },
      {
        id: 'delete',
        label: 'Delete',
        danger: true,
        run: () => {
          const row = this.rows().find((r) => r.id === data.id);
          if (row) {
            this.pendingDelete.set(row);
          }
        },
      },
    ];
  }

  protected navigateEdit(bodyTypeId: number): void {
    const categoryId = this.categoryId();
    if (categoryId) {
      void this.router.navigateByUrl(
        `/admin/vehicles/categories/${categoryId}/body-types/${bodyTypeId}/edit`,
      );
    }
  }

  private buildParams(): HttpParams {
    let params = new HttpParams()
      .set('page', String(this.page()))
      .set('per_page', String(this.pageSize()))
      .set('sort', this.sortField)
      .set('direction', this.sortDirection);

    if (this.compact()) {
      const search = this.searchQuery().trim();
      if (search) {
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

  private loadRows(): void {
    this.load$.next();
  }
}

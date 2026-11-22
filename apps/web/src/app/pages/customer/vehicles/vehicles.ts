import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GetRowIdParams,
  ITextFilterParams,
  ModuleRegistry,
  RowClassRules,
  themeQuartz,
} from 'ag-grid-community';
import { catchError, of, tap } from 'rxjs';

import { ToastrService } from '../../../core/feedback/toastr.service';
import { VehiclesApiService } from '../../../core/vehicles/vehicles-api.service';
import {
  CustomerVehicleBodyType,
  CustomerVehicleCategory,
  VehicleCapacityUnit,
} from '../../../core/vehicle/vehicle.model';
import { createCompactViewportSignal } from '../../../shared/compact-viewport';
import { DataListComponent } from '../../../shared/data-list/data-list';
import {
  DataListAction,
  DataListColumn,
  DataListSortOption,
} from '../../../shared/data-list/data-list.types';
import {
  VehicleBodyTypeActiveCell,
  VehicleBodyTypeActiveCellParams,
} from './vehicle-body-type-active-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface CustomerVehicleBodyTypeRow extends CustomerVehicleBodyType {
  vehicle_category_id: number;
  category_name: string;
}

@Component({
  selector: 'app-customer-vehicles',
  imports: [AgGridAngular, DataListComponent, VehicleBodyTypeActiveCell],
  templateUrl: './vehicles.html',
  styleUrls: ['../../../shared/portal-shell.scss', './vehicles.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerVehicles implements OnInit {
  private readonly vehiclesApi = inject(VehiclesApiService);
  private readonly toastr = inject(ToastrService);

  protected readonly loading = signal(false);
  protected readonly savingIds = signal<Set<number>>(new Set());
  protected readonly error = signal<string | null>(null);
  protected readonly categories = signal<CustomerVehicleCategory[]>([]);
  /** Category ids captured on load so AG Grid column defs stay stable while rows update. */
  private readonly catalogueCategoryIds = signal<number[]>([]);
  protected readonly categoryVisible = signal<Record<number, boolean>>({});
  protected readonly compact = createCompactViewportSignal();
  protected readonly listSearch = signal('');
  protected readonly listSortField = signal<keyof CustomerVehicleBodyTypeRow>('name');
  protected readonly listSortDirection = signal<'asc' | 'desc'>('asc');

  protected readonly theme = themeQuartz;
  protected readonly bodyTypePageSize = 10;
  protected readonly bodyTypeRowHeight = 56;
  protected readonly bodyTypePageSizeSelector = [10, 25, 50];
  private readonly emptyBodyTypeColumns: ColDef<CustomerVehicleBodyTypeRow>[] = [];
  private readonly emptyBodyTypeRows: CustomerVehicleBodyTypeRow[] = [];

  protected readonly allCategoriesChecked = computed(() => {
    const cats = this.categories();
    const vis = this.categoryVisible();
    return cats.length > 0 && cats.every((c) => vis[c.id] !== false);
  });

  protected readonly visibleCategories = computed(() => {
    const vis = this.categoryVisible();
    return this.categories().filter((c) => vis[c.id] !== false);
  });

  protected readonly flatRows = computed((): CustomerVehicleBodyTypeRow[] => {
    const rows: CustomerVehicleBodyTypeRow[] = [];
    for (const category of this.categories()) {
      for (const bodyType of category.body_types ?? []) {
        rows.push({
          ...bodyType,
          vehicle_category_id: category.id,
          category_name: category.name,
        });
      }
    }
    return rows;
  });

  protected readonly filteredListRows = computed(() => {
    const query = this.listSearch().trim().toLowerCase();
    let rows = this.flatRows();
    if (query) {
      rows = rows.filter((row) => {
        const haystack = [
          row.name,
          row.code,
          row.category_name,
          row.capacity_unit,
          String(row.capacity),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }
    const field = this.listSortField();
    const direction = this.listSortDirection();
    const sorted = [...rows].sort((a, b) => {
      const left = String(a[field] ?? '');
      const right = String(b[field] ?? '');
      const cmp = left.localeCompare(right, undefined, { numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  });

  protected readonly bodyTypeRowId = (params: GetRowIdParams<CustomerVehicleBodyTypeRow>): string =>
    String(params.data.id);

  protected readonly bodyTypeRowClassRules: RowClassRules<CustomerVehicleBodyTypeRow> = {
    'body-types-grid__row--inactive': (params) => params.data?.active === false,
  };

  protected readonly listRowClass = (row: CustomerVehicleBodyTypeRow): string | undefined =>
    row.active ? undefined : 'vehicles-list-item--inactive';

  private readonly rowsByCategory = computed(() => {
    const rows = new Map<number, CustomerVehicleBodyTypeRow[]>();
    for (const category of this.categories()) {
      rows.set(
        category.id,
        (category.body_types ?? []).map((bodyType) => ({
          ...bodyType,
          vehicle_category_id: category.id,
          category_name: category.name,
        })),
      );
    }
    return rows;
  });

  protected readonly bodyTypeColumnsByCategory = computed(() => {
    const columns = new Map<number, ColDef<CustomerVehicleBodyTypeRow>[]>();
    const cellParams: VehicleBodyTypeActiveCellParams = {
      onToggle: (row, active) => this.setActive(row, active),
    };
    for (const categoryId of this.catalogueCategoryIds()) {
      columns.set(categoryId, this.createBodyTypeColumnDefs(cellParams));
    }
    return columns;
  });

  protected readonly bodyTypeDefaultsByCategory = computed(() => {
    const defaults = new Map<number, ColDef<CustomerVehicleBodyTypeRow>>();
    for (const categoryId of this.catalogueCategoryIds()) {
      defaults.set(categoryId, {
        sortable: true,
        resizable: true,
        floatingFilter: true,
        flex: 1,
        minWidth: 100,
      });
    }
    return defaults;
  });

  protected readonly listColumns: DataListColumn<CustomerVehicleBodyTypeRow>[] = [
    { field: 'category_name', label: 'Category' },
    { field: 'code', label: 'Code' },
    {
      field: 'capacity',
      label: 'Capacity',
      valueFor: (row) => `${row.capacity} ${this.capacityUnitLabel(row.capacity_unit)}`,
    },
    { field: 'active', label: 'Active', booleanCheckbox: true },
  ];

  protected readonly sortOptions: DataListSortOption[] = [
    { field: 'name', label: 'Name' },
    { field: 'category_name', label: 'Category' },
    { field: 'code', label: 'Code' },
  ];

  protected readonly listTitle = (row: CustomerVehicleBodyTypeRow): string => row.name;

  protected readonly actionsForList = (
    row: CustomerVehicleBodyTypeRow,
  ): DataListAction<CustomerVehicleBodyTypeRow>[] => {
    if (this.savingIds().has(row.id)) {
      return [];
    }
    return [
      {
        id: 'toggle',
        label: row.active ? 'Deactivate' : 'Activate',
        variant: row.active ? 'ghost' : 'primary',
        run: (item) => this.setActive(item, !item.active),
      },
    ];
  };

  ngOnInit(): void {
    this.loadCatalogue();
  }

  protected isCategoryVisible(categoryId: number): boolean {
    return this.categoryVisible()[categoryId] !== false;
  }

  protected toggleCategory(categoryId: number, visible: boolean): void {
    this.categoryVisible.update((current) => ({ ...current, [categoryId]: visible }));
  }

  protected toggleAllCategories(visible: boolean): void {
    const next: Record<number, boolean> = {};
    for (const category of this.categories()) {
      next[category.id] = visible;
    }
    this.categoryVisible.set(next);
  }

  protected bodyTypeColumnsFor(categoryId: number): ColDef<CustomerVehicleBodyTypeRow>[] {
    return this.bodyTypeColumnsByCategory().get(categoryId) ?? this.emptyBodyTypeColumns;
  }

  protected bodyTypesForGrid(category: CustomerVehicleCategory): CustomerVehicleBodyTypeRow[] {
    return this.rowsByCategory().get(category.id) ?? this.emptyBodyTypeRows;
  }

  protected onListSearch(value: string): void {
    this.listSearch.set(value);
  }

  protected onListSortField(field: string): void {
    if (field === 'name' || field === 'category_name' || field === 'code' || field === 'capacity') {
      this.listSortField.set(field);
    }
  }

  protected onListSortDirection(direction: 'asc' | 'desc'): void {
    this.listSortDirection.set(direction);
  }

  protected setActive(row: CustomerVehicleBodyTypeRow, active: boolean): void {
    const previous = row.active;
    if (previous === active || this.savingIds().has(row.id)) {
      return;
    }
    this.patchBodyTypeActive(row.id, active);
    this.savingIds.update((set) => new Set(set).add(row.id));

    this.vehiclesApi
      .setBodyTypeActive(row.id, active)
      .pipe(
        tap(() => {
          this.savingIds.update((set) => {
            const next = new Set(set);
            next.delete(row.id);
            return next;
          });
          this.toastr.success(this.bodyTypeActivationMessage(row, active));
        }),
        catchError(() => {
          this.savingIds.update((set) => {
            const next = new Set(set);
            next.delete(row.id);
            return next;
          });
          this.patchBodyTypeActive(row.id, previous);
          this.toastr.error(
            active
              ? `Could not activate ${this.bodyTypeToastLabel(row)}.`
              : `Could not deactivate ${this.bodyTypeToastLabel(row)}.`,
          );
          return of(null);
        }),
      )
      .subscribe();
  }

  private loadCatalogue(): void {
    this.loading.set(true);
    this.error.set(null);
    this.vehiclesApi
      .getCustomerCatalogue()
      .pipe(
        catchError(() => {
          this.error.set('Could not load vehicles.');
          return of({ vehicle_categories: [] as CustomerVehicleCategory[] });
        }),
      )
      .subscribe((res) => {
        this.categories.set(res.vehicle_categories);
        this.catalogueCategoryIds.set(res.vehicle_categories.map((category) => category.id));
        const visibility: Record<number, boolean> = {};
        for (const category of res.vehicle_categories) {
          visibility[category.id] = true;
        }
        this.categoryVisible.set(visibility);
        this.loading.set(false);
      });
  }

  private bodyTypeToastLabel(row: CustomerVehicleBodyTypeRow): string {
    return `${row.category_name} \\ ${row.name}`;
  }

  private bodyTypeActivationMessage(row: CustomerVehicleBodyTypeRow, active: boolean): string {
    const verb = active ? 'activated' : 'deactivated';
    return `${this.bodyTypeToastLabel(row)} ${verb}.`;
  }

  private patchBodyTypeActive(bodyTypeId: number, active: boolean): void {
    this.categories.update((categories) =>
      categories.map((category) => ({
        ...category,
        body_types: (category.body_types ?? []).map((bodyType) =>
          bodyType.id === bodyTypeId ? { ...bodyType, active } : bodyType,
        ),
      })),
    );
  }

  private createBodyTypeColumnDefs(
    cellParams: VehicleBodyTypeActiveCellParams,
  ): ColDef<CustomerVehicleBodyTypeRow>[] {
    const textFilterParams = (): ITextFilterParams => ({
      debounceMs: 300,
      trimInput: true,
      maxNumConditions: 1,
    });

    return [
      {
        colId: 'active',
        headerName: 'Active',
        flex: 0,
        width: 90,
        minWidth: 90,
        maxWidth: 90,
        sortable: true,
        filter: 'agSetColumnFilter',
        cellRenderer: VehicleBodyTypeActiveCell,
        cellRendererParams: cellParams,
        valueGetter: (params) => (params.data?.active ? 'Yes' : 'No'),
      },
      {
        field: 'name',
        headerName: 'Name',
        flex: 1.2,
        minWidth: 140,
        filter: 'agTextColumnFilter',
        filterParams: textFilterParams(),
      },
      {
        field: 'code',
        headerName: 'Code',
        flex: 0.9,
        minWidth: 100,
        filter: 'agTextColumnFilter',
        filterParams: textFilterParams(),
      },
      {
        field: 'capacity',
        headerName: 'Capacity',
        flex: 0.7,
        minWidth: 100,
        filter: 'agNumberColumnFilter',
      },
      {
        field: 'capacity_unit',
        headerName: 'Unit',
        flex: 0.7,
        minWidth: 90,
        filter: 'agTextColumnFilter',
        filterParams: textFilterParams(),
        valueFormatter: (params) =>
          this.capacityUnitLabel(params.value as VehicleCapacityUnit | undefined),
      },
      {
        field: 'pallet_spaces',
        headerName: 'Pallets',
        flex: 0.7,
        minWidth: 90,
        filter: 'agNumberColumnFilter',
        valueFormatter: (params) =>
          params.value === null || params.value === undefined ? '—' : String(params.value),
      },
      {
        field: 'payload_kg',
        headerName: 'Payload (kg)',
        flex: 0.9,
        minWidth: 110,
        filter: 'agNumberColumnFilter',
        valueFormatter: (params) =>
          params.value === null || params.value === undefined ? '—' : String(params.value),
      },
    ];
  }

  private capacityUnitLabel(unit: VehicleCapacityUnit | undefined): string {
    switch (unit) {
      case 'pallet':
        return 'Pallets';
      case 'm3':
        return 'Cubic metres';
      case 'tonne':
        return 'Tonnes';
      case 'litre':
        return 'Litres';
      case 'head':
        return 'Head';
      default:
        return unit ?? '';
    }
  }
}

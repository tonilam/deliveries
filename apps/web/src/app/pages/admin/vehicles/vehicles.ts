import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GetRowIdParams,
  ITextFilterParams,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';
import { catchError, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { VehicleBodyType, VehicleCategory } from '../../../core/vehicle/vehicle.model';
import {
  VehicleCategoryActionItem,
  VehicleCategoryActionsCell,
  VehicleCategoryActionsCellRow,
} from './vehicle-category-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

interface VehicleBodyTypeGridRow extends VehicleBodyType {
  vehicle_category_id: number;
}

type PendingDelete =
  | { kind: 'category'; category: VehicleCategory }
  | { kind: 'body-type'; category: VehicleCategory; bodyType: VehicleBodyType };

@Component({
  selector: 'app-admin-vehicles',
  imports: [AgGridAngular, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './vehicles.html',
  styleUrls: ['../../../shared/portal-shell.scss', './vehicles.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminVehicles implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly savingCategory = signal(false);
  protected readonly categoryEditOpen = signal(false);
  protected readonly editingCategoryId = signal<number | null>(null);
  protected readonly categoryEditError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(64), Validators.pattern(/^[a-z0-9_]+$/)]],
    sort_order: [0, [Validators.required, Validators.min(0), Validators.max(9999)]],
  });
  protected readonly categories = signal<VehicleCategory[]>([]);
  protected readonly categoryVisible = signal<Record<number, boolean>>({});
  protected readonly pendingDelete = signal<PendingDelete | null>(null);

  protected readonly allCategoriesChecked = computed(() => {
    const cats = this.categories();
    const vis = this.categoryVisible();
    return cats.length > 0 && cats.every((c) => vis[c.id] !== false);
  });

  protected readonly visibleCategories = computed(() => {
    const vis = this.categoryVisible();
    return this.categories().filter((c) => vis[c.id] !== false);
  });

  protected readonly theme = themeQuartz;
  protected readonly bodyTypePageSize = 10;
  protected readonly bodyTypeRowHeight = 64;
  protected readonly bodyTypePageSizeSelector = [10, 25, 50];
  private readonly emptyBodyTypeColumns: ColDef<VehicleBodyTypeGridRow>[] = [];
  private readonly emptyBodyTypeRows: VehicleBodyTypeGridRow[] = [];
  protected readonly bodyTypeRowId = (params: GetRowIdParams<VehicleBodyTypeGridRow>): string =>
    String(params.data.id);

  /** Stable row arrays. A new array on every check makes AG Grid destroy and recreate every row. */
  private readonly rowsByCategory = computed(() => {
    const rows = new Map<number, VehicleBodyTypeGridRow[]>();
    for (const category of this.categories()) {
      rows.set(
        category.id,
        (category.body_types ?? []).map((bodyType) => ({
          ...bodyType,
          vehicle_category_id: category.id,
        })),
      );
    }
    return rows;
  });

  /** Each grid must own its column objects. AG Grid mutates them in place. */
  protected readonly bodyTypeColumnsByCategory = computed(() => {
    const columns = new Map<number, ColDef<VehicleBodyTypeGridRow>[]>();
    for (const category of this.categories()) {
      columns.set(category.id, this.createBodyTypeColumnDefs());
    }
    return columns;
  });

  protected readonly bodyTypeDefaultsByCategory = computed(() => {
    const defaults = new Map<number, ColDef<VehicleBodyTypeGridRow>>();
    for (const category of this.categories()) {
      defaults.set(category.id, {
        sortable: true,
        resizable: true,
        floatingFilter: true,
        flex: 1,
        minWidth: 100,
      });
    }
    return defaults;
  });

  private createBodyTypeColumnDefs(): ColDef<VehicleBodyTypeGridRow>[] {
    const textFilterParams = (): ITextFilterParams => ({
      debounceMs: 300,
      trimInput: true,
      maxNumConditions: 1,
    });

    return [
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
          actionsFor: (data: VehicleCategoryActionsCellRow) =>
            this.bodyTypeActionsFromRow(data as VehicleBodyTypeGridRow),
        },
      },
    ];
  }

  ngOnInit(): void {
    this.loadCatalogue();
  }

  protected toggleAllCategories(checked: boolean): void {
    const next: Record<number, boolean> = {};
    for (const category of this.categories()) {
      next[category.id] = checked;
    }
    this.categoryVisible.set(next);
  }

  protected toggleCategory(categoryId: number, checked: boolean): void {
    this.categoryVisible.update((current) => ({ ...current, [categoryId]: checked }));
  }

  protected isCategoryVisible(categoryId: number): boolean {
    return this.categoryVisible()[categoryId] !== false;
  }

  protected bodyTypeColumnsFor(categoryId: number): ColDef<VehicleBodyTypeGridRow>[] {
    return this.bodyTypeColumnsByCategory().get(categoryId) ?? this.emptyBodyTypeColumns;
  }

  protected bodyTypesForGrid(category: VehicleCategory): VehicleBodyTypeGridRow[] {
    return this.rowsByCategory().get(category.id) ?? this.emptyBodyTypeRows;
  }

  protected openEditCategory(category: VehicleCategory): void {
    this.categoryEditError.set(null);
    this.editingCategoryId.set(category.id);
    this.categoryForm.reset({
      name: category.name,
      code: category.code,
      sort_order: category.sort_order,
    });
    this.categoryEditOpen.set(true);
  }

  protected cancelEditCategory(): void {
    if (!this.savingCategory()) {
      this.categoryEditOpen.set(false);
      this.editingCategoryId.set(null);
      this.categoryEditError.set(null);
    }
  }

  protected saveEditCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const id = this.editingCategoryId();
    if (id === null || this.savingCategory()) {
      return;
    }

    this.savingCategory.set(true);
    this.categoryEditError.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.put(`/api/admin/vehicle-categories/${id}`, this.categoryForm.getRawValue()),
        ),
      )
      .subscribe({
        next: () => {
          this.savingCategory.set(false);
          this.categoryEditOpen.set(false);
          this.editingCategoryId.set(null);
          this.loadCatalogue();
          this.toastr.success('Vehicle category updated.');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          const messages = err.error?.errors;
          const message =
            messages?.['code']?.[0] ??
            messages?.['name']?.[0] ??
            err.error?.message ??
            'Unable to save category.';
          this.categoryEditError.set(message);
          this.toastr.error(message);
          this.savingCategory.set(false);
        },
      });
  }

  protected requestDeleteCategory(category: VehicleCategory): void {
    this.pendingDelete.set({ kind: 'category', category });
  }

  protected requestDeleteBodyType(category: VehicleCategory, bodyType: VehicleBodyType): void {
    this.pendingDelete.set({ kind: 'body-type', category, bodyType });
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const pending = this.pendingDelete();
    if (!pending || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    const request$ =
      pending.kind === 'category'
        ? this.http.delete(`/api/admin/vehicle-categories/${pending.category.id}`)
        : this.http.delete(
            `/api/admin/vehicle-categories/${pending.category.id}/body-types/${pending.bodyType.id}`,
          );

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.pendingDelete.set(null);
          this.deleting.set(false);
          this.loadCatalogue();
          const label = pending.kind === 'category' ? 'Vehicle category' : 'Body type';
          this.toastr.success(`${label} deleted.`);
        },
        error: (err: { error?: { errors?: Record<string, string[]> } }) => {
          const message =
            err.error?.errors?.['vehicle_category']?.[0] ?? 'Unable to delete. Please try again.';
          this.error.set(message);
          this.toastr.error(message);
          this.deleting.set(false);
        },
      });
  }

  protected deleteMessage(pending: PendingDelete): string {
    if (pending.kind === 'category') {
      return `Delete category “${pending.category.name}”? This is only allowed when it has no body types.`;
    }
    return `Delete body type “${pending.bodyType.name}” and its option definitions?`;
  }

  protected navigateEditBodyType(categoryId: number, bodyTypeId: number): void {
    void this.router.navigateByUrl(
      `/admin/vehicles/categories/${categoryId}/body-types/${bodyTypeId}/edit`,
    );
  }

  private bodyTypeActionsFromRow(row: VehicleBodyTypeGridRow): VehicleCategoryActionItem[] {
    const category = this.categories().find((c) => c.id === row.vehicle_category_id);
    if (!category) {
      return [];
    }

    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => this.navigateEditBodyType(row.vehicle_category_id, row.id),
      },
      {
        id: 'delete',
        label: 'Delete',
        danger: true,
        run: () => this.requestDeleteBodyType(category, row),
      },
    ];
  }

  private loadCatalogue(): void {
    this.loading.set(true);
    this.error.set(null);

    const params = new HttpParams().set('catalogue', '1');

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http
            .get<{ vehicle_categories: VehicleCategory[] }>('/api/admin/vehicle-categories', {
              params,
            })
            .pipe(
              catchError(() => {
                this.error.set('Unable to load vehicle catalogue.');
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
        this.categories.set(res.vehicle_categories);
        const visible: Record<number, boolean> = { ...this.categoryVisible() };
        for (const category of res.vehicle_categories) {
          if (visible[category.id] === undefined) {
            visible[category.id] = true;
          }
        }
        this.categoryVisible.set(visible);
        this.loading.set(false);
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { AdminCountriesApiService } from '../../../../core/admin/admin-countries-api.service';
import { ToastrService } from '../../../../core/feedback/toastr.service';
import { Country, CountryState } from '../../../../core/country/country.model';
import {
  VehicleCategoryActionItem,
  VehicleCategoryActionsCell,
  VehicleCategoryActionsCellRow,
} from '../../vehicles/vehicle-category-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

interface CountryStateGridRow extends CountryState {
  country_id: number;
}

type PendingDelete =
  { kind: 'country'; country: Country } | { kind: 'state'; country: Country; state: CountryState };

@Component({
  selector: 'app-admin-countries',
  imports: [AgGridAngular, RouterLink],
  templateUrl: './countries.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './countries.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCountries implements OnInit {
  private readonly countriesApi = inject(AdminCountriesApiService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly countries = signal<Country[]>([]);
  protected readonly pending = signal<PendingDelete | null>(null);

  protected readonly theme = themeQuartz;
  protected readonly statePageSize = 10;
  protected readonly stateRowHeight = 64;
  protected readonly statePageSizeSelector = [10, 25, 50];

  private readonly emptyStateColumns: ColDef<CountryStateGridRow>[] = [];
  private readonly emptyStateRows: CountryStateGridRow[] = [];

  protected readonly stateRowId = (params: GetRowIdParams<CountryStateGridRow>): string =>
    String(params.data.id);

  private readonly rowsByCountry = computed(() => {
    const rows = new Map<number, CountryStateGridRow[]>();
    for (const country of this.countries()) {
      rows.set(
        country.id,
        (country.states ?? []).map((state) => ({
          ...state,
          country_id: country.id,
        })),
      );
    }
    return rows;
  });

  protected readonly stateColumnsByCountry = computed(() => {
    const columns = new Map<number, ColDef<CountryStateGridRow>[]>();
    for (const country of this.countries()) {
      columns.set(country.id, this.createStateColumnDefs());
    }
    return columns;
  });

  protected readonly stateDefaultsByCountry = computed(() => {
    const defaults = new Map<number, ColDef<CountryStateGridRow>>();
    for (const country of this.countries()) {
      defaults.set(country.id, {
        sortable: true,
        resizable: true,
        floatingFilter: true,
        flex: 1,
        minWidth: 100,
      });
    }
    return defaults;
  });

  private createStateColumnDefs(): ColDef<CountryStateGridRow>[] {
    const textFilterParams = (): ITextFilterParams => ({
      debounceMs: 300,
      trimInput: true,
      maxNumConditions: 1,
    });

    return [
      {
        field: 'code',
        headerName: 'Code',
        flex: 0.7,
        minWidth: 90,
        filter: 'agTextColumnFilter',
        filterParams: textFilterParams(),
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
        cellClass: 'states-grid__actions-cell',
        cellRenderer: VehicleCategoryActionsCell,
        cellRendererParams: {
          actionsFor: (data: VehicleCategoryActionsCellRow) =>
            this.stateActionsFromRow(data as CountryStateGridRow),
        },
      },
    ];
  }

  ngOnInit(): void {
    this.loadCountries();
  }

  protected stateColumnsFor(countryId: number): ColDef<CountryStateGridRow>[] {
    return this.stateColumnsByCountry().get(countryId) ?? this.emptyStateColumns;
  }

  protected statesForGrid(country: Country): CountryStateGridRow[] {
    return this.rowsByCountry().get(country.id) ?? this.emptyStateRows;
  }

  protected requestDeleteCountry(country: Country): void {
    if (this.deleting()) {
      return;
    }
    this.error.set(null);
    this.pending.set({ kind: 'country', country });
  }

  protected requestDeleteState(country: Country, state: CountryState): void {
    if (this.deleting()) {
      return;
    }
    this.error.set(null);
    this.pending.set({ kind: 'state', country, state });
  }

  protected cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.pending.set(null);
  }

  protected confirmDelete(): void {
    const pending = this.pending();
    if (!pending || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    const request$ =
      pending.kind === 'country'
        ? this.countriesApi.deleteCountry(pending.country.id)
        : this.countriesApi.deleteState(pending.country.id, pending.state.id);

    request$.subscribe({
      next: () => {
        this.pending.set(null);
        this.deleting.set(false);
        this.loadCountries();
        const label = pending.kind === 'country' ? 'Country' : 'State';
        this.toastr.success(`${label} deleted.`);
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        const message =
          err.error?.errors?.['country']?.[0] ??
          err.error?.message ??
          'Unable to delete. Please try again.';
        this.error.set(message);
        this.toastr.error(message);
        this.deleting.set(false);
      },
    });
  }

  protected confirmMessage(pending: PendingDelete): string {
    if (pending.kind === 'country') {
      return `Delete country “${pending.country.name}” and all of its states?`;
    }
    return `Delete state “${pending.state.name}” (${pending.state.code}) from ${pending.country.name}?`;
  }

  private stateActionsFromRow(row: CountryStateGridRow): VehicleCategoryActionItem[] {
    const country = this.countries().find((c) => c.id === row.country_id);
    if (!country) {
      return [];
    }

    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => this.navigateEditState(row.country_id, row.id),
      },
      {
        id: 'delete',
        label: 'Delete',
        danger: true,
        run: () => this.requestDeleteState(country, row),
      },
    ];
  }

  private navigateEditState(countryId: number, stateId: number): void {
    void this.router.navigateByUrl(`/admin/settings/countries/${countryId}/states/${stateId}/edit`);
  }

  private loadCountries(): void {
    this.loading.set(true);
    this.error.set(null);

    this.countriesApi.list().subscribe({
      next: (res) => {
        this.countries.set(res.countries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load countries. Please try again.');
        this.loading.set(false);
      },
    });
  }
}

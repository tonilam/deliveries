import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { map } from 'rxjs';

ModuleRegistry.registerModules([AllCommunityModule]);

export type AddressType = 'collection' | 'delivery';

export interface AddressRow {
  id: number;
  type: AddressType;
  business_name: string;
  address: string;
  zone: string;
  state: string;
  postcode: string;
}

@Component({
  selector: 'app-customer-addresses',
  imports: [AgGridAngular, RouterLink],
  templateUrl: './addresses.html',
  styleUrls: ['../../../shared/portal-shell.scss', './addresses.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddresses implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly theme = themeQuartz;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rowData = signal<AddressRow[]>([]);

  protected readonly columnDefs: ColDef<AddressRow>[] = [
    {
      field: 'type',
      headerName: 'Type',
      flex: 0.8,
      minWidth: 120,
      valueFormatter: (params) =>
        params.value === 'collection'
          ? 'Collection'
          : params.value === 'delivery'
            ? 'Delivery'
            : (params.value ?? ''),
    },
    { field: 'business_name', headerName: 'Business name', flex: 1.2, minWidth: 160 },
    { field: 'address', headerName: 'Address', flex: 1.4, minWidth: 180 },
    { field: 'zone', headerName: 'Zone', flex: 0.9, minWidth: 120 },
    { field: 'state', headerName: 'State', flex: 0.6, minWidth: 90 },
    { field: 'postcode', headerName: 'Postcode', flex: 0.7, minWidth: 100 },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  ngOnInit(): void {
    this.loadAddresses();
  }

  private loadAddresses(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<{ addresses: AddressRow[] }>('/api/addresses')
      .pipe(map((res) => res.addresses))
      .subscribe({
        next: (addresses) => {
          this.rowData.set(addresses);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load addresses. Please try again.');
          this.loading.set(false);
        },
      });
  }
}

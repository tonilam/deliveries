import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { map } from 'rxjs';

import { Company } from '../../../core/company/company.model';
import {
  CompanyActionItem,
  CompanyActionsCell,
  CompanyActionsCellRow,
} from './company-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-admin-companies',
  imports: [AgGridAngular, RouterLink],
  templateUrl: './companies.html',
  styleUrls: ['../../../shared/portal-shell.scss', './companies.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCompanies implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly theme = themeQuartz;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly companies = signal<Company[]>([]);

  protected readonly columnDefs: ColDef<Company>[] = [
    { field: 'business_name', headerName: 'Business name', flex: 1.2, minWidth: 180 },
    { field: 'reg_number', headerName: 'Reg number', flex: 0.9, minWidth: 130 },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 180 },
    {
      field: 'allowed_domains',
      headerName: 'Allowed domains',
      flex: 1.2,
      minWidth: 160,
      valueFormatter: (params) => (Array.isArray(params.value) ? params.value.join(', ') : ''),
    },
    {
      headerName: 'Actions',
      flex: 0.9,
      minWidth: 140,
      sortable: false,
      filter: false,
      cellClass: 'users-grid__actions-cell',
      cellRenderer: CompanyActionsCell,
      cellRendererParams: {
        actionsFor: (data: CompanyActionsCellRow) => this.actionsFor(data),
      },
    },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  ngOnInit(): void {
    this.loadCompanies();
  }

  private actionsFor(data: CompanyActionsCellRow): CompanyActionItem[] {
    return [
      {
        id: 'edit',
        label: 'Edit',
        run: () => {
          void this.router.navigateByUrl(`/admin/companies/${data.id}/edit`);
        },
      },
      {
        id: 'add-customer',
        label: 'Add customer',
        run: () => {
          void this.router.navigate(['/admin/users/create'], {
            queryParams: { role: 'customer', company_id: data.id },
          });
        },
      },
    ];
  }

  private loadCompanies(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<{ companies: Company[] }>('/api/admin/companies')
      .pipe(map((res) => res.companies))
      .subscribe({
        next: (companies) => {
          this.companies.set(companies);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load companies. Please try again.');
          this.loading.set(false);
        },
      });
  }
}

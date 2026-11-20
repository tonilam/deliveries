import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from 'ag-grid-community';

import { forkJoin, map } from 'rxjs';

import { UserRole } from '../../../core/auth/user.model';

ModuleRegistry.registerModules([AllCommunityModule]);

export type UsersTab = 'admin' | 'customer';

export interface ManagedUserRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

@Component({
  selector: 'app-admin-users',
  imports: [AgGridAngular],
  templateUrl: './users.html',
  styleUrls: ['../../../shared/portal-shell.scss', './users.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly theme = themeQuartz;
  protected readonly activeTab = signal<UsersTab>('admin');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly adminUsers = signal<ManagedUserRow[]>([]);
  protected readonly customerUsers = signal<ManagedUserRow[]>([]);

  protected readonly rowData = computed(() =>
    this.activeTab() === 'admin' ? this.adminUsers() : this.customerUsers(),
  );

  protected readonly columnDefs: ColDef<ManagedUserRow>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'email', headerName: 'Email', flex: 1.4, minWidth: 200 },
    {
      field: 'is_active',
      headerName: 'Active',
      flex: 0.6,
      minWidth: 100,
      valueFormatter: (params) => (params.value ? 'Yes' : 'No'),
    },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  ngOnInit(): void {
    this.loadAllUsers();
  }

  protected selectTab(tab: UsersTab): void {
    this.activeTab.set(tab);
  }

  private loadAllUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      admin: this.fetchUsers('admin'),
      customer: this.fetchUsers('customer'),
    }).subscribe({
      next: ({ admin, customer }) => {
        this.adminUsers.set(admin);
        this.customerUsers.set(customer);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load users. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private fetchUsers(role: UserRole) {
    return this.http
      .get<{ users: ManagedUserRow[] }>('/api/admin/users', { params: { role } })
      .pipe(map((res) => res.users));
  }
}

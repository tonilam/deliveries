import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';

import { forkJoin, map } from 'rxjs';

import { UserRole } from '../../../core/auth/user.model';

ModuleRegistry.registerModules([AllCommunityModule]);

export type UsersTab = 'admin' | 'customer';

export interface ManagedUserRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  has_password: boolean;
}

@Component({
  selector: 'app-admin-users',
  imports: [AgGridAngular, RouterLink],
  templateUrl: './users.html',
  styleUrls: ['../../../shared/portal-shell.scss', './users.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly theme = themeQuartz;
  protected readonly activeTab = signal<UsersTab>('admin');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly inviteNotice = signal<string | null>(null);
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
    {
      headerName: 'Actions',
      flex: 0.9,
      minWidth: 140,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<ManagedUserRow>) => {
        if (!params.data?.has_password) {
          return '';
        }
        const link = document.createElement('a');
        link.href = `/admin/users/${params.data.id}/reset-password`;
        link.textContent = 'Reset password';
        link.className = 'grid-action-link';
        link.addEventListener('click', (event) => {
          event.preventDefault();
          void this.router.navigateByUrl(`/admin/users/${params.data!.id}/reset-password`);
        });
        return link;
      },
    },
  ];

  protected readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'admin' || tab === 'customer') {
      this.activeTab.set(tab);
    }

    const invited = this.route.snapshot.queryParamMap.get('invited');
    const passwordReset = this.route.snapshot.queryParamMap.get('passwordReset');
    if (invited && passwordReset) {
      this.inviteNotice.set(
        `Invitation sent to ${invited}. Password updated for ${passwordReset}.`,
      );
    } else if (invited) {
      this.inviteNotice.set(`Invitation sent to ${invited}.`);
    } else if (passwordReset) {
      this.inviteNotice.set(`Password updated for ${passwordReset}.`);
    }
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

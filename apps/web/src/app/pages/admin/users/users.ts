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
import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from 'ag-grid-community';

import { forkJoin, map } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/user.model';
import { UserActionItem, UserActionsCell, UserActionsCellRow } from './user-actions-cell';

ModuleRegistry.registerModules([AllCommunityModule]);

export type UsersTab = 'admin' | 'customer';

export interface ManagedUserRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  has_password: boolean;
  company: string | null;
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
  private readonly auth = inject(AuthService);

  protected readonly theme = themeQuartz;
  protected readonly activeTab = signal<UsersTab>('admin');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly inviteNotice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly adminUsers = signal<ManagedUserRow[]>([]);
  protected readonly customerUsers = signal<ManagedUserRow[]>([]);

  protected readonly rowData = computed(() =>
    this.activeTab() === 'admin' ? this.adminUsers() : this.customerUsers(),
  );

  protected readonly columnDefs = computed<ColDef<ManagedUserRow>[]>(() => {
    const cols: ColDef<ManagedUserRow>[] = [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    ];

    if (this.activeTab() === 'customer') {
      cols.push({
        field: 'company',
        headerName: 'Company',
        flex: 1,
        minWidth: 160,
        valueFormatter: (params) => params.value ?? '',
      });
    }

    cols.push(
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
        cellClass: 'users-grid__actions-cell',
        cellRenderer: UserActionsCell,
        cellRendererParams: {
          actionsFor: (data: UserActionsCellRow) => this.actionsFor(data),
        },
      },
    );

    return cols;
  });

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
    this.actionError.set(null);
  }

  private actionsFor(data: UserActionsCellRow): UserActionItem[] {
    const actions: UserActionItem[] = [];

    if (this.activeTab() === 'customer' && data.is_active) {
      actions.push({
        id: 'impersonate',
        label: 'Impersonate',
        run: () => this.impersonate(data),
      });
    }

    if (data.has_password) {
      actions.push({
        id: 'reset-password',
        label: 'Reset password',
        run: () => {
          void this.router.navigateByUrl(`/admin/users/${data.id}/reset-password`);
        },
      });
    }

    return actions;
  }

  private impersonate(data: UserActionsCellRow): void {
    this.actionError.set(null);
    this.auth.impersonate(data.id).subscribe({
      next: (user) => {
        void this.router.navigateByUrl(this.auth.homePathFor(user));
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        const first = err.error?.errors?.['user']?.[0] ?? err.error?.message;
        this.actionError.set(first ?? 'Unable to impersonate this user.');
      },
    });
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

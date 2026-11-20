import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-customer-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: '../../../shared/portal-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDashboard {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-admin-home',
  templateUrl: './admin-home.html',
  styleUrl: '../../../shared/portal-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHome {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrl: '../../shared/portal-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
}

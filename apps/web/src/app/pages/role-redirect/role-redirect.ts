import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-role-redirect',
  template: '<p class="loading">Loading…</p>',
  styles: `
    .loading {
      margin: 3rem auto;
      max-width: 40rem;
      padding: 0 1.5rem;
      color: #334155;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleRedirect implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const current = this.auth.user();
    if (current) {
      void this.router.navigateByUrl(this.auth.homePathFor(current));
      return;
    }

    this.auth.me().subscribe((user) => {
      if (user) {
        void this.router.navigateByUrl(this.auth.homePathFor(user));
        return;
      }
      void this.router.navigateByUrl('/login');
    });
  }
}

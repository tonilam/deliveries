import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.html',
  styleUrl: './auth-callback.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallback implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly message = signal('Completing sign-in…');

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: (user) => {
        if (user) {
          void this.router.navigateByUrl(this.auth.homePathFor(user));
          return;
        }
        this.message.set('Sign-in did not complete.');
        void this.router.navigateByUrl('/login?error=sso_failed');
      },
      error: () => {
        void this.router.navigateByUrl('/login?error=sso_failed');
      },
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, distinctUntilChanged, exhaustMap, interval, map, switchMap } from 'rxjs';

import { AuthService } from './auth.service';

export const SESSION_CHECK_INTERVAL_MS = 300_000;

@Injectable({ providedIn: 'root' })
export class SessionMonitor {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    toObservable(this.auth.user)
      .pipe(
        map((user) => user?.id ?? null),
        distinctUntilChanged(),
        switchMap((userId) => {
          if (userId === null) {
            return EMPTY;
          }
          return interval(SESSION_CHECK_INTERVAL_MS).pipe(
            exhaustMap(() => this.auth.probeSession()),
          );
        }),
      )
      .subscribe((result) => {
        if (result !== 'expired' || this.router.url.startsWith('/login')) {
          return;
        }
        void this.router.navigate(['/login'], {
          queryParams: { error: 'session_expired' },
          replaceUrl: true,
        });
      });
  }
}

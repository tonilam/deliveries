import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';

import { AuthService } from './auth.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Fetch Sanctum CSRF cookie before state-changing API requests. */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    return next(req);
  }
  if (req.url.includes('/sanctum/csrf-cookie')) {
    return next(req);
  }

  const auth = inject(AuthService);
  return auth.ensureCsrf().pipe(switchMap(() => next(req)));
};

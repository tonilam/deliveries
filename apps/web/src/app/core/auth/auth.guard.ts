import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from './auth.service';
import { User } from './user.model';

function redirectForUser(user: User, router: Router, auth: AuthService) {
  return router.createUrlTree([auth.homePathFor(user)]);
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return auth.me().pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return redirectForUser(auth.user()!, router, auth);
  }

  return auth.me().pipe(map((user) => (user ? redirectForUser(user, router, auth) : true)));
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allow = (user: User | null) => {
    if (!user) {
      return router.createUrlTree(['/login']);
    }
    if (user.must_change_password) {
      return router.createUrlTree(['/change-password']);
    }
    if (user.role !== 'admin') {
      return router.createUrlTree(['/app']);
    }
    return true;
  };

  if (auth.isAuthenticated()) {
    return allow(auth.user());
  }

  return auth.me().pipe(map((user) => allow(user)));
};

export const customerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allow = (user: User | null) => {
    if (!user) {
      return router.createUrlTree(['/login']);
    }
    if (user.must_change_password) {
      return router.createUrlTree(['/change-password']);
    }
    if (user.role !== 'customer') {
      return router.createUrlTree(['/admin']);
    }
    return true;
  };

  if (auth.isAuthenticated()) {
    return allow(auth.user());
  }

  return auth.me().pipe(map((user) => allow(user)));
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { FeatureService } from './feature.service';

/** Blocks /register when user registration is disabled. */
export const registrationEnabledGuard: CanActivateFn = () => {
  const features = inject(FeatureService);
  const router = inject(Router);

  return features
    .loadPublicFlags()
    .pipe(map((flags) => (flags.user_registration ? true : router.createUrlTree(['/login']))));
};

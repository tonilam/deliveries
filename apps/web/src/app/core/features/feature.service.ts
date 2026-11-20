import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

import { AdminFeature, PublicFeatureFlags } from './feature.model';

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private readonly http = inject(HttpClient);

  /** Cached public flags for guest UI (register links, route guard). */
  private readonly publicFlags = signal<PublicFeatureFlags | null>(null);
  private publicFlagsRequest$: Observable<PublicFeatureFlags> | null = null;

  readonly flags = this.publicFlags.asReadonly();

  loadPublicFlags(force = false): Observable<PublicFeatureFlags> {
    if (!force && this.publicFlags()) {
      return of(this.publicFlags()!);
    }

    if (!force && this.publicFlagsRequest$) {
      return this.publicFlagsRequest$;
    }

    this.publicFlagsRequest$ = this.http
      .get<{ features: PublicFeatureFlags }>('/api/features')
      .pipe(
        map((res) => res.features),
        tap((features) => {
          this.publicFlags.set(features);
          this.publicFlagsRequest$ = null;
        }),
        catchError(() => {
          this.publicFlagsRequest$ = null;
          // Fail open for register UI if the flags endpoint is unreachable.
          const fallback: PublicFeatureFlags = { user_registration: true };
          this.publicFlags.set(fallback);
          return of(fallback);
        }),
        shareReplay(1),
      );

    return this.publicFlagsRequest$;
  }

  isRegistrationEnabled(): boolean {
    return this.publicFlags()?.user_registration !== false;
  }

  listAdminFeatures(): Observable<AdminFeature[]> {
    return this.http
      .get<{ features: AdminFeature[] }>('/api/admin/features')
      .pipe(map((res) => res.features));
  }

  updateFeature(key: string, enabled: boolean): Observable<AdminFeature> {
    return this.http
      .patch<{ feature: AdminFeature }>(`/api/admin/features/${key}`, { enabled })
      .pipe(
        map((res) => res.feature),
        tap((feature) => {
          if (feature.key === 'user_registration') {
            const current = this.publicFlags();
            this.publicFlags.set({
              ...(current ?? { user_registration: feature.enabled }),
              user_registration: feature.enabled,
            });
          }
        }),
      );
  }
}

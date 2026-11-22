import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap } from 'rxjs';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

interface ActivityUser {
  id: number;
  name: string;
}

interface ActivityChange {
  field: string;
  label: string;
  old: unknown;
  new: unknown;
}

interface LoadActivityRow {
  id: number;
  event: string;
  description: string;
  created_at: string;
  causer: ActivityUser | null;
  impersonator: ActivityUser | null;
  item: { id: number; label: string } | null;
  changes: ActivityChange[];
}

interface ActivityListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface ActivityListResponse {
  activities: LoadActivityRow[];
  meta: ActivityListMeta;
}

@Component({
  selector: 'app-load-activity-panel',
  imports: [],
  templateUrl: './load-activity-panel.html',
  styleUrls: ['./load-activity-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadActivityPanel {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly loadId = input.required<number>();
  /** Bump to refetch after saves elsewhere. */
  readonly refreshToken = input(0);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<LoadActivityRow[]>([]);
  protected readonly meta = signal<ActivityListMeta | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<number>(25);
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  private readonly fetch$ = new Subject<{
    loadId: number;
    page: number;
    perPage: number;
    token: number;
  }>();

  constructor() {
    this.fetch$
      .pipe(
        switchMap(({ loadId, page, perPage }) => {
          this.loading.set(true);
          this.error.set(null);

          const params = new HttpParams()
            .set('page', String(page))
            .set('per_page', String(perPage));

          return this.http
            .get<ActivityListResponse>(`/api/loads/${loadId}/activity`, { params })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((body) => {
        this.loading.set(false);
        if (!body) {
          this.error.set('Unable to load activity.');
          this.rows.set([]);
          this.meta.set(null);
          return;
        }
        this.rows.set(body.activities);
        this.meta.set(body.meta);
      });

    effect(() => {
      this.fetch$.next({
        loadId: this.loadId(),
        page: this.page(),
        perPage: this.pageSize(),
        token: this.refreshToken(),
      });
    });
  }

  protected formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  protected formatWhen(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  protected goToPage(next: number): void {
    this.page.set(next);
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }
}

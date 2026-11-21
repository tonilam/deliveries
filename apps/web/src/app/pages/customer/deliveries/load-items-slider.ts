import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { displayUnitLabel, formatWeightForDisplay, ItemRow } from './item-format';
import { LoadRow } from './load.types';

interface ItemsListResponse {
  items: ItemRow[];
}

@Component({
  selector: 'app-load-items-slider',
  imports: [],
  templateUrl: './load-items-slider.html',
  styleUrl: './load-items-slider.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadItemsSlider {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);

  readonly load = input.required<LoadRow>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly loading = signal(false);
  protected readonly assigning = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly assigned = signal<ItemRow[]>([]);
  protected readonly unassigned = signal<ItemRow[]>([]);
  protected readonly tab = signal<'assigned' | 'available'>('assigned');

  constructor() {
    effect(() => {
      const current = this.load();
      if (current.id > 0) {
        this.reloadLists();
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected selectTab(tab: 'assigned' | 'available'): void {
    this.tab.set(tab);
  }

  protected itemSummary(item: ItemRow): string {
    const weight = `${formatWeightForDisplay(item.weight_tonnes, item.display_unit)} ${displayUnitLabel(item.display_unit)}`;
    const refs = [item.order_number, item.connote].filter(Boolean).join(' · ');
    return refs ? `${weight} · ${refs}` : weight;
  }

  protected assignItem(item: ItemRow): void {
    if (this.assigning()) {
      return;
    }

    const loadId = this.load().id;
    this.assigning.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<{ item: ItemRow }>(`/api/loads/${loadId}/items`, { item_id: item.id }),
        ),
      )
      .subscribe({
        next: () => {
          this.assigning.set(false);
          this.toastr.success('Item assigned to load.');
          this.reloadLists();
          this.changed.emit();
        },
        error: () => {
          this.assigning.set(false);
          const message = 'Unable to assign item.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected unassignItem(item: ItemRow): void {
    if (this.assigning()) {
      return;
    }

    const loadId = this.load().id;
    this.assigning.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.delete(`/api/loads/${loadId}/items/${item.id}`)))
      .subscribe({
        next: () => {
          this.assigning.set(false);
          this.toastr.success('Item removed from load.');
          this.reloadLists();
          this.changed.emit();
        },
        error: () => {
          this.assigning.set(false);
          const message = 'Unable to remove item.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  private reloadLists(): void {
    const loadId = this.load().id;
    this.loading.set(true);
    this.error.set(null);

    this.http.get<ItemsListResponse>(`/api/items?load_id=${loadId}&per_page=200&page=1`).subscribe({
      next: (assignedRes) => {
        this.assigned.set(assignedRes.items);
        this.http.get<ItemsListResponse>('/api/items?unassigned=1&per_page=200&page=1').subscribe({
          next: (unassignedRes) => {
            this.unassigned.set(unassignedRes.items);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.error.set('Unable to load unassigned items.');
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load items on this load.');
      },
    });
  }
}

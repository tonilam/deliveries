import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminFeature } from '../../../core/features/feature.model';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { FeatureService } from '../../../core/features/feature.service';

interface PendingToggle {
  feature: AdminFeature;
  nextEnabled: boolean;
}

@Component({
  selector: 'app-admin-features',
  imports: [FormsModule],
  templateUrl: './features.html',
  styleUrls: ['../../../shared/portal-shell.scss', './features.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFeatures implements OnInit {
  private readonly featuresApi = inject(FeatureService);
  private readonly toastr = inject(ToastrService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly features = signal<AdminFeature[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly pending = signal<PendingToggle | null>(null);

  protected readonly filteredFeatures = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.features();
    if (!query) {
      return list;
    }
    return list.filter(
      (feature) =>
        feature.name.toLowerCase().includes(query) ||
        feature.description.toLowerCase().includes(query) ||
        feature.key.toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    this.loadFeatures();
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  protected requestToggle(feature: AdminFeature): void {
    if (this.saving()) {
      return;
    }
    this.error.set(null);
    this.pending.set({
      feature,
      nextEnabled: !feature.enabled,
    });
  }

  protected cancelToggle(): void {
    if (this.saving()) {
      return;
    }
    this.pending.set(null);
  }

  protected confirmToggle(): void {
    const pending = this.pending();
    if (!pending || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.featuresApi.updateFeature(pending.feature.key, pending.nextEnabled).subscribe({
      next: (updated) => {
        this.features.update((list) =>
          list.map((item) => (item.key === updated.key ? updated : item)),
        );
        this.pending.set(null);
        this.saving.set(false);
        const action = updated.enabled ? 'enabled' : 'disabled';
        this.toastr.success(`Feature ${action}.`);
      },
      error: () => {
        const message = 'Unable to update feature. Please try again.';
        this.error.set(message);
        this.toastr.error(message);
        this.saving.set(false);
      },
    });
  }

  protected confirmMessage(pending: PendingToggle): string {
    const action = pending.nextEnabled ? 'enable' : 'disable';
    return `Are you sure you want to ${action} “${pending.feature.name}”?`;
  }

  private loadFeatures(): void {
    this.loading.set(true);
    this.error.set(null);

    this.featuresApi.listAdminFeatures().subscribe({
      next: (features) => {
        this.features.set(features);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load features. Please try again.');
        this.loading.set(false);
      },
    });
  }
}

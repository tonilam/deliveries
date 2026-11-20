import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { Country, CountryState } from '../../../../core/country/country.model';

type PendingDelete =
  { kind: 'country'; country: Country } | { kind: 'state'; country: Country; state: CountryState };

@Component({
  selector: 'app-admin-countries',
  imports: [RouterLink],
  templateUrl: './countries.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './countries.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCountries implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly countries = signal<Country[]>([]);
  protected readonly pending = signal<PendingDelete | null>(null);

  ngOnInit(): void {
    this.loadCountries();
  }

  protected requestDeleteCountry(country: Country): void {
    if (this.deleting()) {
      return;
    }
    this.error.set(null);
    this.pending.set({ kind: 'country', country });
  }

  protected requestDeleteState(country: Country, state: CountryState): void {
    if (this.deleting()) {
      return;
    }
    this.error.set(null);
    this.pending.set({ kind: 'state', country, state });
  }

  protected cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.pending.set(null);
  }

  protected confirmDelete(): void {
    const pending = this.pending();
    if (!pending || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);

    const request$ =
      pending.kind === 'country'
        ? this.http.delete(`/api/admin/countries/${pending.country.id}`)
        : this.http.delete(`/api/admin/countries/${pending.country.id}/states/${pending.state.id}`);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.pending.set(null);
          this.deleting.set(false);
          this.loadCountries();
        },
        error: () => {
          this.error.set('Unable to delete. Please try again.');
          this.deleting.set(false);
        },
      });
  }

  protected confirmMessage(pending: PendingDelete): string {
    if (pending.kind === 'country') {
      return `Delete country “${pending.country.name}” and all of its states?`;
    }
    return `Delete state “${pending.state.name}” (${pending.state.code}) from ${pending.country.name}?`;
  }

  private loadCountries(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<{ countries: Country[] }>('/api/admin/countries').subscribe({
      next: (res) => {
        this.countries.set(res.countries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load countries. Please try again.');
        this.loading.set(false);
      },
    });
  }
}

import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { Country, CountryPayload } from '../../../../core/country/country.model';

@Component({
  selector: 'app-admin-country-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './country-form.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './country-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCountryForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly loading = signal(false);
  protected readonly countryId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.countryId() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit country' : 'Add country'));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      this.error.set('Invalid country.');
      return;
    }

    this.countryId.set(id);
    this.loading.set(true);

    this.http.get<{ country: Country }>(`/api/admin/countries/${id}`).subscribe({
      next: (res) => {
        this.form.patchValue({
          name: res.country.name,
          code: res.country.code,
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load country.');
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload: CountryPayload = {
      name: this.form.controls.name.value.trim(),
      code: this.form.controls.code.value.trim().toUpperCase(),
    };

    const id = this.countryId();
    const request$ =
      id === null
        ? this.http.post<{ country: Country }>('/api/admin/countries', payload)
        : this.http.put<{ country: Country }>(`/api/admin/countries/${id}`, payload);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl('/admin/settings/countries');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          this.error.set(this.firstError(err) ?? 'Could not save country');
        },
      });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return errors?.['name']?.[0] ?? errors?.['code']?.[0] ?? err.error?.message;
  }
}

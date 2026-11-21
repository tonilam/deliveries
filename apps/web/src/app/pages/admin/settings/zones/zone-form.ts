import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastrService } from '../../../../core/feedback/toastr.service';
import { Country } from '../../../../core/country/country.model';
import { Zone, ZonePayload } from '../../../../core/zone/zone.model';

@Component({
  selector: 'app-admin-zone-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './zone-form.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './zone-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminZoneForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly loading = signal(false);
  protected readonly countries = signal<Country[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: [
      '',
      [Validators.required, Validators.maxLength(10), Validators.pattern(/^[A-Za-z0-9]+$/)],
    ],
    country_id: [0, [Validators.required, Validators.min(1)]],
    is_active: [true],
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<{ countries: Country[] }>('/api/admin/countries').subscribe({
      next: (res) => {
        this.countries.set(res.countries);
        if (res.countries.length > 0) {
          this.form.controls.country_id.setValue(res.countries[0].id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load countries.');
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

    const payload: ZonePayload = {
      name: this.form.controls.name.value.trim(),
      code: this.form.controls.code.value.trim().toUpperCase(),
      country_id: this.form.controls.country_id.value,
      is_active: this.form.controls.is_active.value,
    };

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.post<{ zone: Zone }>('/api/admin/zones', payload)))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toastr.success('Zone created.');
          void this.router.navigateByUrl('/admin/settings/zones');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          const message = this.firstError(err) ?? 'Could not save zone';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return (
      errors?.['name']?.[0] ??
      errors?.['code']?.[0] ??
      errors?.['country_id']?.[0] ??
      err.error?.message
    );
  }
}

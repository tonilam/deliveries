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
import { ToastrService } from '../../../../core/feedback/toastr.service';
import { Country, CountryState, CountryStatePayload } from '../../../../core/country/country.model';

@Component({
  selector: 'app-admin-state-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './state-form.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './state-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStateForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly loading = signal(false);
  protected readonly countryId = signal<number | null>(null);
  protected readonly stateId = signal<number | null>(null);
  protected readonly countryName = signal<string>('');
  protected readonly isEdit = computed(() => this.stateId() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit state' : 'Add state'));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(10)]],
  });

  ngOnInit(): void {
    const countryParam = this.route.snapshot.paramMap.get('countryId');
    const stateParam = this.route.snapshot.paramMap.get('stateId');

    const countryId = Number(countryParam);
    if (!Number.isFinite(countryId)) {
      this.error.set('Invalid country.');
      return;
    }

    this.countryId.set(countryId);
    this.loading.set(true);

    this.http.get<{ country: Country }>(`/api/admin/countries/${countryId}`).subscribe({
      next: (res) => {
        this.countryName.set(res.country.name);

        if (stateParam) {
          const stateId = Number(stateParam);
          if (!Number.isFinite(stateId)) {
            this.error.set('Invalid state.');
            this.loading.set(false);
            return;
          }

          const state = res.country.states.find((item) => item.id === stateId);
          if (!state) {
            this.error.set('State not found for this country.');
            this.loading.set(false);
            return;
          }

          this.stateId.set(stateId);
          this.form.patchValue({
            name: state.name,
            code: state.code,
          });
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load country.');
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    const countryId = this.countryId();
    if (countryId === null || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload: CountryStatePayload = {
      name: this.form.controls.name.value.trim(),
      code: this.form.controls.code.value.trim().toUpperCase(),
    };

    const stateId = this.stateId();
    const request$ =
      stateId === null
        ? this.http.post<{ state: CountryState }>(
            `/api/admin/countries/${countryId}/states`,
            payload,
          )
        : this.http.put<{ state: CountryState }>(
            `/api/admin/countries/${countryId}/states/${stateId}`,
            payload,
          );

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toastr.success(this.stateId() === null ? 'State created.' : 'State updated.');
          void this.router.navigateByUrl('/admin/settings/countries');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          const message = this.firstError(err) ?? 'Could not save state';
          this.error.set(message);
          this.toastr.error(message);
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

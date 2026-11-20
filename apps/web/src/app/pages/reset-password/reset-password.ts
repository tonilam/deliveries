import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly success = signal(false);

  private readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  });

  protected readonly hasToken = !!this.email && !!this.token;

  protected submit(): void {
    if (!this.hasToken || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<{ message: string }>('/api/password/reset', {
            email: this.email,
            token: this.token,
            password: raw.password,
            password_confirmation: raw.password_confirmation,
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          const errors = err.error?.errors;
          const first =
            errors?.['email']?.[0] ??
            errors?.['password']?.[0] ??
            errors?.['token']?.[0] ??
            err.error?.message;
          this.error.set(first ?? 'Could not reset password');
        },
      });
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl('/login');
  }
}

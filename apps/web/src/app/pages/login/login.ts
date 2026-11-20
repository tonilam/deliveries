import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SsoProvider } from '../../core/auth/user.model';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'sso_failed') {
      this.error.set('Sign-in with the identity provider failed. Try again or use email.');
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        const first = err.error?.errors?.['email']?.[0] ?? err.error?.message;
        this.error.set(first ?? 'Login failed');
      },
    });
  }

  protected sso(provider: SsoProvider): void {
    this.auth.startSso(provider);
  }
}

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { FeatureService } from '../../core/features/feature.service';
import { SsoProvider } from '../../core/auth/user.model';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly features = inject(FeatureService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly registrationEnabled = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('error');
    if (ssoError === 'sso_failed') {
      this.error.set('Sign-in with the identity provider failed. Try again or use email.');
    } else if (ssoError === 'registration_disabled') {
      this.error.set('User registration is currently disabled. Sign in with an existing account.');
    }
  }

  ngOnInit(): void {
    this.features.loadPublicFlags().subscribe((flags) => {
      this.registrationEnabled.set(flags.user_registration !== false);
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        void this.router.navigateByUrl(this.auth.homePathFor(user));
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

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { SsoProvider } from '../../core/auth/user.model';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.register(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        void this.router.navigateByUrl(this.auth.homePathFor(user));
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        const errors = err.error?.errors;
        const first =
          errors?.['email']?.[0] ??
          errors?.['password']?.[0] ??
          errors?.['name']?.[0] ??
          err.error?.message;
        this.error.set(first ?? 'Registration failed');
      },
    });
  }

  protected sso(provider: SsoProvider): void {
    this.auth.startSso(provider);
  }
}

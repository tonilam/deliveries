import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ToastrService } from '../../core/feedback/toastr.service';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePassword implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    current_password: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const go = () => {
      const user = this.auth.user();
      if (!user) {
        void this.router.navigateByUrl('/login');
        return;
      }
      if (!user.must_change_password) {
        void this.router.navigateByUrl(this.auth.homePathFor(user));
      }
    };

    if (this.auth.isAuthenticated()) {
      go();
      return;
    }

    this.auth.me().subscribe(() => go());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.updatePassword(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.toastr.success('Password updated.');
        void this.router.navigateByUrl(this.auth.homePathFor(user));
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        const errors = err.error?.errors;
        const message =
          errors?.['current_password']?.[0] ??
          errors?.['password']?.[0] ??
          err.error?.message ??
          'Could not update password';
        this.error.set(message);
        this.toastr.error(message);
      },
    });
  }
}

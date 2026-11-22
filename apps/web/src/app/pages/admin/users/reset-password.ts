import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminUsersApiService } from '../../../core/admin/admin-users-api.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { UserRole } from '../../../core/auth/user.model';

interface ManagedUserDetail {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  has_password: boolean;
}

@Component({
  selector: 'app-admin-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrls: ['../../../shared/portal-shell.scss', './reset-password.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminResetPassword implements OnInit {
  private readonly usersApi = inject(AdminUsersApiService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly user = signal<ManagedUserDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly settingPassword = signal(false);
  protected readonly sendingEmail = signal(false);

  protected readonly canSetPassword = computed(() => {
    const u = this.user();
    return !!u && u.has_password && u.role === 'customer';
  });

  protected readonly canSendEmail = computed(() => {
    const u = this.user();
    return !!u && u.has_password;
  });

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
    must_change_password: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigateByUrl('/admin/users');
      return;
    }

    this.usersApi.get<{ user: ManagedUserDetail }>(Number(id)).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.loading.set(false);
        if (!res.user.has_password) {
          this.error.set('Password reset is not available for SSO-only users.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load user.');
      },
    });
  }

  protected generatePassword(): void {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    const password = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
    this.form.patchValue({
      password,
      password_confirmation: password,
    });
  }

  protected setPassword(): void {
    if (!this.canSetPassword() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const u = this.user();
    if (!u) {
      return;
    }

    this.settingPassword.set(true);
    this.error.set(null);
    this.notice.set(null);

    const raw = this.form.getRawValue();
    this.usersApi
      .updatePassword(u.id, {
        password: raw.password,
        password_confirmation: raw.password_confirmation,
        must_change_password: raw.must_change_password,
      })
      .subscribe({
        next: () => {
          this.settingPassword.set(false);
          this.toastr.success('Password updated.');
          void this.router.navigate(['/admin/users'], {
            queryParams: { passwordReset: u.email, tab: u.role },
          });
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.settingPassword.set(false);
          const message = this.firstError(err) ?? 'Could not update password';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected sendResetEmail(): void {
    if (!this.canSendEmail()) {
      return;
    }

    const u = this.user();
    if (!u) {
      return;
    }

    this.sendingEmail.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.usersApi.sendPasswordReset(u.id).subscribe({
      next: (res) => {
        this.sendingEmail.set(false);
        const message = `Password reset email sent to ${res.email}.`;
        this.notice.set(message);
        this.toastr.success(message);
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.sendingEmail.set(false);
        const message = this.firstError(err) ?? 'Could not send reset email';
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
      errors?.['user']?.[0] ??
      errors?.['password']?.[0] ??
      errors?.['email']?.[0] ??
      err.error?.message
    );
  }
}

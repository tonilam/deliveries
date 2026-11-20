import { HttpClient } from '@angular/common/http';
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
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { User, UserRole } from '../../../core/auth/user.model';
import { Company } from '../../../core/company/company.model';

type CreateMode = 'password' | 'invite';

@Component({
  selector: 'app-admin-create-user',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-user.html',
  styleUrls: ['../../../shared/portal-shell.scss', './create-user.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCreateUser implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly mode = signal<CreateMode>('password');
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly companies = signal<Company[]>([]);
  protected readonly companiesLoading = signal(false);
  protected readonly companyLocked = signal(false);
  protected readonly isPasswordMode = computed(() => this.mode() === 'password');
  protected readonly isCustomerRole = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    role: this.fb.nonNullable.control<UserRole>('customer', [Validators.required]),
    company_id: this.fb.control<number | null>(null),
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
    must_change_password: [true],
  });

  ngOnInit(): void {
    const role = this.route.snapshot.queryParamMap.get('role');
    if (role === 'admin' || role === 'customer') {
      this.form.controls.role.setValue(role);
    }

    const companyIdRaw = this.route.snapshot.queryParamMap.get('company_id');
    const companyId = companyIdRaw ? Number(companyIdRaw) : null;
    if (companyId !== null && Number.isFinite(companyId)) {
      this.form.controls.company_id.setValue(companyId);
      this.form.controls.company_id.disable({ emitEvent: false });
      this.form.controls.role.setValue('customer');
      this.form.controls.role.disable({ emitEvent: false });
      this.companyLocked.set(true);
    }

    this.syncCompanyValidators(this.form.controls.role.value);
    this.form.controls.role.valueChanges.subscribe((nextRole) => {
      this.syncCompanyValidators(nextRole);
    });

    this.loadCompanies();
  }

  protected setMode(mode: CreateMode): void {
    this.mode.set(mode);
    this.error.set(null);

    const password = this.form.controls.password;
    const confirmation = this.form.controls.password_confirmation;
    if (mode === 'password') {
      password.setValidators([Validators.required, Validators.minLength(8)]);
      confirmation.setValidators([Validators.required]);
    } else {
      password.clearValidators();
      confirmation.clearValidators();
      password.setValue('');
      confirmation.setValue('');
    }
    password.updateValueAndValidity();
    confirmation.updateValueAndValidity();
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

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const companyId = raw.role === 'customer' ? raw.company_id : null;

    if (this.mode() === 'password') {
      this.auth
        .ensureCsrf()
        .pipe(
          switchMap(() =>
            this.http.post<{ user: User }>('/api/admin/users', {
              name: raw.name,
              email: raw.email,
              role: raw.role,
              company_id: companyId,
              password: raw.password,
              password_confirmation: raw.password_confirmation,
              must_change_password: raw.must_change_password,
            }),
          ),
        )
        .subscribe({
          next: () => {
            this.submitting.set(false);
            void this.router.navigateByUrl('/admin/users');
          },
          error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
            this.submitting.set(false);
            this.error.set(this.firstError(err) ?? 'Could not create user');
          },
        });
      return;
    }

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<{ message: string }>('/api/admin/invitations', {
            name: raw.name,
            email: raw.email,
            role: raw.role,
            company_id: companyId,
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigate(['/admin/users'], {
            queryParams: { invited: raw.email },
          });
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          this.error.set(this.firstError(err) ?? 'Could not send invitation');
        },
      });
  }

  private syncCompanyValidators(role: UserRole): void {
    this.isCustomerRole.set(role === 'customer');
    const company = this.form.controls.company_id;
    if (role === 'customer') {
      company.setValidators([Validators.required]);
    } else {
      company.clearValidators();
      if (!this.companyLocked()) {
        company.setValue(null);
      }
    }
    company.updateValueAndValidity();
  }

  private loadCompanies(): void {
    this.companiesLoading.set(true);
    this.http.get<{ companies: Company[] }>('/api/admin/companies').subscribe({
      next: ({ companies }) => {
        this.companies.set(companies);
        this.companiesLoading.set(false);
      },
      error: () => {
        this.companiesLoading.set(false);
        this.error.set('Unable to load companies.');
      },
    });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return (
      errors?.['email']?.[0] ??
      errors?.['company_id']?.[0] ??
      errors?.['password']?.[0] ??
      errors?.['name']?.[0] ??
      errors?.['role']?.[0] ??
      err.error?.message
    );
  }
}

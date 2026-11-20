import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  normalizeBusinessName,
  normalizeDomains,
  normalizeRegNumber,
} from '../../../core/company/company-normalize';
import { Company, CompanyPayload } from '../../../core/company/company.model';

type FieldKey = 'business_name' | 'reg_number' | 'allowed_domains';
type FieldStatus = 'pending' | 'checking' | 'ok' | 'conflict' | 'error';

interface FieldCheck {
  status: FieldStatus;
  message: string | null;
}

interface UniquenessCheckResponse {
  ok: boolean;
  fields: Record<FieldKey, { ok: boolean; message: string | null }>;
}

const EMPTY_CHECKS: Record<FieldKey, FieldCheck> = {
  business_name: { status: 'pending', message: null },
  reg_number: { status: 'pending', message: null },
  allowed_domains: { status: 'pending', message: null },
};

@Component({
  selector: 'app-admin-company-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './company-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './company-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCompanyForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly loading = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly checking = signal(false);
  protected readonly checkError = signal<string | null>(null);
  protected readonly fieldChecks = signal<Record<FieldKey, FieldCheck>>({ ...EMPTY_CHECKS });
  protected readonly pendingPayload = signal<CompanyPayload | null>(null);
  private checkGeneration = 0;
  protected readonly companyId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.companyId() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit company' : 'Create company'));
  protected readonly allFieldsOk = computed(() => {
    const checks = this.fieldChecks();
    return (
      checks.business_name.status === 'ok' &&
      checks.reg_number.status === 'ok' &&
      checks.allowed_domains.status === 'ok'
    );
  });
  protected readonly hasConflicts = computed(() => {
    const checks = this.fieldChecks();
    return (
      checks.business_name.status === 'conflict' ||
      checks.reg_number.status === 'conflict' ||
      checks.allowed_domains.status === 'conflict'
    );
  });
  protected readonly canConfirm = computed(
    () => this.allFieldsOk() && !this.checking() && !this.submitting() && !this.checkError(),
  );

  protected readonly form = this.fb.nonNullable.group({
    reg_number: ['', [Validators.required, Validators.maxLength(255)]],
    reg_type: ['ABN', [Validators.required, Validators.maxLength(255)]],
    business_name: ['', [Validators.required, Validators.maxLength(255)]],
    invoicee_name: ['', [Validators.required, Validators.maxLength(255)]],
    phone: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required, Validators.maxLength(1000)]],
    allowed_domains: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      void this.router.navigateByUrl('/admin/companies');
      return;
    }

    this.companyId.set(id);
    this.loading.set(true);
    this.http.get<{ company: Company }>(`/api/admin/companies/${id}`).subscribe({
      next: ({ company }) => {
        this.form.patchValue({
          reg_number: company.reg_number,
          reg_type: company.reg_type,
          business_name: company.business_name,
          invoicee_name: company.invoicee_name,
          phone: company.phone,
          email: company.email,
          address: company.address,
          allowed_domains: (company.allowed_domains ?? []).join(', '),
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load company.');
        this.loading.set(false);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const domains = normalizeDomains(
      raw.allowed_domains
        .split(/[\s,;]+/)
        .map((d) => d.trim())
        .filter(Boolean),
    );

    if (domains.length === 0) {
      this.error.set('Add at least one allowed email domain.');
      return;
    }

    const payload: CompanyPayload = {
      reg_number: normalizeRegNumber(raw.reg_number),
      reg_type: raw.reg_type.trim(),
      business_name: normalizeBusinessName(raw.business_name),
      invoicee_name: raw.invoicee_name.trim(),
      phone: raw.phone.trim(),
      email: raw.email.trim(),
      address: raw.address.trim(),
      allowed_domains: domains,
    };

    this.error.set(null);
    this.checkError.set(null);
    this.pendingPayload.set(payload);
    this.form.disable({ emitEvent: false });
    this.confirmOpen.set(true);
    this.runUniquenessCheck(payload);
  }

  protected cancelConfirm(): void {
    if (this.submitting()) {
      return;
    }
    this.checkGeneration += 1;
    this.confirmOpen.set(false);
    this.pendingPayload.set(null);
    this.checking.set(false);
    this.checkError.set(null);
    this.fieldChecks.set({ ...EMPTY_CHECKS });
    this.form.enable({ emitEvent: false });
  }

  protected confirmSave(): void {
    const payload = this.pendingPayload();
    if (!payload || !this.canConfirm()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const id = this.companyId();
    const request$ =
      id === null
        ? this.auth
            .ensureCsrf()
            .pipe(
              switchMap(() =>
                this.http.post<{ company: Company }>('/api/admin/companies', payload),
              ),
            )
        : this.auth
            .ensureCsrf()
            .pipe(
              switchMap(() =>
                this.http.put<{ company: Company }>(`/api/admin/companies/${id}`, payload),
              ),
            );

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.pendingPayload.set(null);
        void this.router.navigateByUrl('/admin/companies');
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.pendingPayload.set(null);
        this.fieldChecks.set({ ...EMPTY_CHECKS });
        this.form.enable({ emitEvent: false });
        this.error.set(this.firstError(err) ?? 'Could not save company');
      },
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.confirmOpen() && !this.submitting()) {
      this.cancelConfirm();
    }
  }

  private runUniquenessCheck(payload: CompanyPayload): void {
    const generation = ++this.checkGeneration;
    this.checking.set(true);
    this.checkError.set(null);
    this.fieldChecks.set({
      business_name: { status: 'checking', message: null },
      reg_number: { status: 'checking', message: null },
      allowed_domains: { status: 'checking', message: null },
    });

    const body: Record<string, unknown> = {
      business_name: payload.business_name,
      reg_number: payload.reg_number,
      allowed_domains: payload.allowed_domains,
    };
    const companyId = this.companyId();
    if (companyId !== null) {
      body['company_id'] = companyId;
    }

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<UniquenessCheckResponse>('/api/admin/companies/check-uniqueness', body),
        ),
      )
      .subscribe({
        next: (result) => {
          if (!this.isCurrentCheck(generation)) {
            return;
          }
          this.fieldChecks.set({
            business_name: this.toFieldCheck(result.fields.business_name),
            reg_number: this.toFieldCheck(result.fields.reg_number),
            allowed_domains: this.toFieldCheck(result.fields.allowed_domains),
          });
          this.checking.set(false);
        },
        error: () => {
          if (!this.isCurrentCheck(generation)) {
            return;
          }
          this.checking.set(false);
          this.checkError.set('Unable to verify uniqueness. Please try again.');
          this.fieldChecks.set({
            business_name: { status: 'error', message: null },
            reg_number: { status: 'error', message: null },
            allowed_domains: { status: 'error', message: null },
          });
        },
      });
  }

  private isCurrentCheck(generation: number): boolean {
    return this.confirmOpen() && this.checkGeneration === generation;
  }

  private toFieldCheck(field: { ok: boolean; message: string | null }): FieldCheck {
    return field.ok
      ? { status: 'ok', message: null }
      : { status: 'conflict', message: field.message };
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return (
      errors?.['allowed_domains']?.[0] ??
      errors?.['business_name']?.[0] ??
      errors?.['reg_number']?.[0] ??
      errors?.['email']?.[0] ??
      err.error?.message
    );
  }
}

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
import { Company, CompanyDetailsPayload, CompanyType } from '../../../core/company/company.model';
import { Country } from '../../../core/country/country.model';
import {
  RadioCardGroupComponent,
  RadioCardOption,
} from '../../../shared/radio-card-group/radio-card-group';

const ROOT_COMPANY_TYPE_OPTIONS: RadioCardOption[] = [
  {
    value: 'customer',
    label: 'Customer',
    description: 'Buys from providers; network is providers only.',
  },
  {
    value: 'provider',
    label: 'Provider',
    description: 'Supplies customers; network is customers only.',
  },
  {
    value: 'broker',
    label: 'Broker',
    description: 'Manages both customers and providers in the network.',
  },
];

const LINKED_COMPANY_TYPE_OPTIONS: RadioCardOption[] = ROOT_COMPANY_TYPE_OPTIONS.filter(
  (option) => option.value !== 'broker',
);

type FieldKey = 'business_name' | 'reg_number' | 'allowed_domains';
type FieldStatus = 'pending' | 'checking' | 'ok' | 'conflict' | 'error';
type EditTab = 'details' | 'finance';

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

const DEFAULT_GST_PERCENT = 10;

@Component({
  selector: 'app-admin-company-form',
  imports: [ReactiveFormsModule, RouterLink, RadioCardGroupComponent],
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
  protected readonly financeSuccess = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly financeSubmitting = signal(false);
  protected readonly loading = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly checking = signal(false);
  protected readonly checkError = signal<string | null>(null);
  protected readonly fieldChecks = signal<Record<FieldKey, FieldCheck>>({ ...EMPTY_CHECKS });
  protected readonly pendingPayload = signal<CompanyDetailsPayload | null>(null);
  protected readonly countries = signal<Country[]>([]);
  protected readonly hasAddresses = signal(false);
  protected readonly parentBusinessName = signal<string | null>(null);
  protected readonly countryLocked = computed(() => this.isEdit() && this.hasAddresses());
  protected readonly isLinkedCompany = computed(() => this.parentBusinessName() !== null);
  protected readonly companyTypeRadioOptions = computed((): RadioCardOption[] =>
    this.isLinkedCompany() ? LINKED_COMPANY_TYPE_OPTIONS : ROOT_COMPANY_TYPE_OPTIONS,
  );
  private checkGeneration = 0;
  protected readonly companyId = signal<number | null>(null);
  protected readonly activeTab = signal<EditTab>('details');
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
  protected readonly pendingCountryName = computed(() => {
    const payload = this.pendingPayload();
    if (!payload) {
      return '';
    }
    return this.countries().find((country) => country.id === payload.country_id)?.name ?? '';
  });

  protected readonly detailsForm = this.fb.nonNullable.group({
    company_type: this.fb.nonNullable.control<CompanyType>('broker', [Validators.required]),
    country_id: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    reg_number: ['', [Validators.required, Validators.maxLength(255)]],
    reg_type: ['ABN', [Validators.required, Validators.maxLength(255)]],
    business_name: ['', [Validators.required, Validators.maxLength(255)]],
    phone: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required, Validators.maxLength(1000)]],
    allowed_domains: ['', [Validators.required]],
  });

  protected readonly financeForm = this.fb.nonNullable.group({
    invoicee_name: ['', [Validators.maxLength(255)]],
    gst_percent: [
      DEFAULT_GST_PERCENT,
      [Validators.required, Validators.min(0), Validators.max(100)],
    ],
    tracking_option: ['', [Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<{ countries: Country[] }>('/api/admin/countries').subscribe({
      next: ({ countries }) => {
        this.countries.set(countries);
        this.loadCompanyIfEditing();
      },
      error: () => {
        this.error.set('Unable to load countries.');
        this.loading.set(false);
      },
    });
  }

  private loadCompanyIfEditing(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.loading.set(false);
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      void this.router.navigateByUrl('/admin/companies');
      return;
    }

    this.companyId.set(id);
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'finance') {
      this.activeTab.set('finance');
    }

    this.http.get<{ company: Company }>(`/api/admin/companies/${id}`).subscribe({
      next: ({ company }) => {
        this.patchCompany(company);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load company.');
        this.loading.set(false);
      },
    });
  }

  protected selectTab(tab: EditTab): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.financeSuccess.set(null);
  }

  protected submitDetails(): void {
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    const details = this.buildDetailsPayload();
    if (!details) {
      return;
    }

    this.error.set(null);
    this.checkError.set(null);
    this.pendingPayload.set(details);
    this.detailsForm.disable({ emitEvent: false });
    this.financeForm.disable({ emitEvent: false });
    this.confirmOpen.set(true);
    this.runUniquenessCheck(details);
  }

  protected submitFinance(): void {
    if (!this.isEdit()) {
      return;
    }

    if (this.financeForm.invalid) {
      this.financeForm.markAllAsTouched();
      return;
    }

    const id = this.companyId();
    if (id === null) {
      return;
    }

    const finance = this.buildFinancePayload();

    this.financeSubmitting.set(true);
    this.error.set(null);
    this.financeSuccess.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.put<{ company: Company }>(`/api/admin/companies/${id}`, {
            section: 'finance',
            ...finance,
          }),
        ),
      )
      .subscribe({
        next: ({ company }) => {
          this.patchFinance(company);
          this.financeSubmitting.set(false);
          this.financeSuccess.set('Finance details saved.');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.financeSubmitting.set(false);
          this.error.set(this.firstError(err) ?? 'Could not save finance details');
        },
      });
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
    this.detailsForm.enable({ emitEvent: false });
    this.financeForm.enable({ emitEvent: false });
    this.syncCountryControlLock();
  }

  protected confirmSave(): void {
    const payload = this.pendingPayload();
    if (!payload || !this.canConfirm()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const id = this.companyId();
    const detailsBody = {
      section: 'details' as const,
      company_type: payload.company_type,
      country_id: payload.country_id,
      reg_number: payload.reg_number,
      reg_type: payload.reg_type,
      business_name: payload.business_name,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      allowed_domains: payload.allowed_domains,
    };
    const request$ =
      id === null
        ? this.auth
            .ensureCsrf()
            .pipe(
              switchMap(() =>
                this.http.post<{ company: Company }>('/api/admin/companies', detailsBody),
              ),
            )
        : this.auth
            .ensureCsrf()
            .pipe(
              switchMap(() =>
                this.http.put<{ company: Company }>(`/api/admin/companies/${id}`, detailsBody),
              ),
            );

    request$.subscribe({
      next: ({ company }) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.pendingPayload.set(null);
        if (id === null) {
          void this.router.navigateByUrl(`/admin/companies/${company.id}/edit?tab=finance`);
          return;
        }
        this.patchDetails(company);
        this.detailsForm.enable({ emitEvent: false });
        this.financeForm.enable({ emitEvent: false });
        this.syncCountryControlLock();
        this.fieldChecks.set({ ...EMPTY_CHECKS });
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.pendingPayload.set(null);
        this.fieldChecks.set({ ...EMPTY_CHECKS });
        this.detailsForm.enable({ emitEvent: false });
        this.financeForm.enable({ emitEvent: false });
        this.syncCountryControlLock();
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

  private patchCompany(company: Company): void {
    this.patchDetails(company);
    this.patchFinance(company);
  }

  private patchDetails(company: Company): void {
    this.hasAddresses.set(company.has_addresses);
    this.parentBusinessName.set(company.parent_business_name);
    this.detailsForm.patchValue({
      company_type: company.company_type,
      country_id: company.country_id,
      reg_number: company.reg_number,
      reg_type: company.reg_type,
      business_name: company.business_name,
      phone: company.phone,
      email: company.email,
      address: company.address,
      allowed_domains: (company.allowed_domains ?? []).join(', '),
    });
    this.syncCountryControlLock();
  }

  private syncCountryControlLock(): void {
    const control = this.detailsForm.controls.country_id;
    if (this.countryLocked()) {
      control.disable({ emitEvent: false });
    } else {
      control.enable({ emitEvent: false });
    }
  }

  private patchFinance(company: Company): void {
    this.financeForm.patchValue({
      invoicee_name: company.invoicee_name ?? '',
      gst_percent: this.rateToPercent(company.gst_rate),
      tracking_option: company.tracking_option ?? '',
    });
  }

  private buildDetailsPayload(): CompanyDetailsPayload | null {
    const raw = this.detailsForm.getRawValue();
    const countryId = raw.country_id;
    if (countryId === null || !Number.isFinite(countryId)) {
      this.error.set('Select a country.');
      return null;
    }

    const domains = normalizeDomains(
      raw.allowed_domains
        .split(/[\s,;]+/)
        .map((d) => d.trim())
        .filter(Boolean),
    );

    if (domains.length === 0) {
      this.error.set('Add at least one allowed email domain.');
      return null;
    }

    return {
      company_type: raw.company_type,
      country_id: countryId,
      reg_number: normalizeRegNumber(raw.reg_number),
      reg_type: raw.reg_type.trim(),
      business_name: normalizeBusinessName(raw.business_name),
      phone: raw.phone.trim(),
      email: raw.email.trim(),
      address: raw.address.trim(),
      allowed_domains: domains,
    };
  }

  private buildFinancePayload(): {
    invoicee_name: string;
    gst_rate: number;
    tracking_option: string | null;
  } {
    const raw = this.financeForm.getRawValue();
    const tracking = raw.tracking_option.trim();
    return {
      invoicee_name: raw.invoicee_name.trim(),
      gst_rate: this.percentToRate(raw.gst_percent),
      tracking_option: tracking === '' ? null : tracking,
    };
  }

  private rateToPercent(rate: number | null | undefined): number {
    if (rate === null || rate === undefined || Number.isNaN(rate)) {
      return DEFAULT_GST_PERCENT;
    }
    return Math.round(rate * 10000) / 100;
  }

  private percentToRate(percent: number): number {
    return Math.round(percent * 10000) / 1_000_000;
  }

  private runUniquenessCheck(payload: CompanyDetailsPayload): void {
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
      errors?.['country_id']?.[0] ??
      errors?.['allowed_domains']?.[0] ??
      errors?.['business_name']?.[0] ??
      errors?.['reg_number']?.[0] ??
      errors?.['gst_rate']?.[0] ??
      errors?.['email']?.[0] ??
      err.error?.message
    );
  }
}

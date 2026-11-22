import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';

import { AdminCompaniesApiService } from '../../../core/admin/admin-companies-api.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
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
import { AdminCompanyNetwork } from './company-network';

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
type EditTab = 'details' | 'finance' | 'network';

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
  imports: [ReactiveFormsModule, RouterLink, RadioCardGroupComponent, AdminCompanyNetwork],
  templateUrl: './company-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './company-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCompanyForm implements OnInit {
  private readonly companiesApi = inject(AdminCompaniesApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly error = signal<string | null>(null);
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
  protected readonly parentCompanyId = signal<number | null>(null);
  protected readonly parentBusinessName = signal<string | null>(null);
  protected readonly linkedCompanyRole = signal<'customer' | 'provider' | null>(null);
  protected readonly rootCompanyType = signal<CompanyType>('broker');
  protected readonly blockedRootCompanyTypes = signal<CompanyType[]>([]);
  protected readonly countryLocked = computed(() => this.isEdit() && this.hasAddresses());
  protected readonly isLinkedCompany = computed(() => this.parentCompanyId() !== null);
  protected readonly showNetworkTab = computed(() => this.isEdit() && !this.isLinkedCompany());
  protected readonly detailsDirty = signal(false);
  protected readonly companyTypeRadioOptions = computed((): RadioCardOption[] => {
    const base = this.isLinkedCompany() ? LINKED_COMPANY_TYPE_OPTIONS : ROOT_COMPANY_TYPE_OPTIONS;
    const blocked = new Set(this.blockedRootCompanyTypes());
    return base.map((option) => ({
      ...option,
      disabled: blocked.has(option.value as CompanyType),
    }));
  });
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
    this.detailsForm.valueChanges.subscribe(() => {
      this.detailsDirty.set(this.detailsForm.dirty);
    });

    this.loading.set(true);
    this.companiesApi.getCountries().subscribe({
      next: ({ countries }) => {
        this.countries.set(countries);
        combineLatest([this.route.paramMap, this.route.queryParamMap])
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(([params, query]) => {
            this.syncRoute(params, query);
          });
      },
      error: () => {
        this.error.set('Unable to load countries.');
        this.loading.set(false);
      },
    });
  }

  private syncRoute(params: ParamMap, query: ParamMap): void {
    if (this.confirmOpen() && !this.submitting()) {
      this.cancelConfirm();
    }

    const idParam = params.get('id');
    if (!idParam) {
      this.companyId.set(null);
      this.parentCompanyId.set(null);
      this.parentBusinessName.set(null);
      this.linkedCompanyRole.set(null);
      this.blockedRootCompanyTypes.set([]);
      this.activeTab.set('details');
      this.loading.set(false);
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      void this.router.navigateByUrl('/admin/companies');
      return;
    }

    const tab = query.get('tab');
    if (tab === 'finance') {
      this.activeTab.set('finance');
    } else if (tab === 'network') {
      this.activeTab.set('network');
    } else {
      this.activeTab.set('details');
    }

    this.error.set(null);
    this.loading.set(true);
    this.companyId.set(id);

    this.companiesApi.get(id).subscribe({
      next: ({ company }) => {
        if (this.companyId() !== id) {
          return;
        }
        this.patchCompany(company);
        this.loading.set(false);
      },
      error: () => {
        if (this.companyId() !== id) {
          return;
        }
        this.error.set('Unable to load company.');
        this.loading.set(false);
      },
    });
  }

  protected selectTab(tab: EditTab): void {
    if (tab === 'network' && this.detailsDirty()) {
      this.error.set('Save company details before managing the network.');
      return;
    }
    this.activeTab.set(tab);
    this.error.set(null);
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

    this.companiesApi
      .update(id, {
        section: 'finance',
        ...finance,
      })
      .subscribe({
        next: ({ company }) => {
          this.patchFinance(company);
          this.financeSubmitting.set(false);
          this.toastr.success('Finance details saved.');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.financeSubmitting.set(false);
          const message = this.firstError(err) ?? 'Could not save finance details';
          this.error.set(message);
          this.toastr.error(message);
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
        ? this.companiesApi.create(detailsBody)
        : this.companiesApi.update(id, detailsBody);

    request$.subscribe({
      next: ({ company }) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.pendingPayload.set(null);
        if (id === null) {
          this.toastr.success('Company created.');
          void this.router.navigateByUrl(`/admin/companies/${company.id}/edit?tab=finance`);
          return;
        }
        this.patchDetails(company);
        this.detailsForm.enable({ emitEvent: false });
        this.financeForm.enable({ emitEvent: false });
        this.syncCountryControlLock();
        this.fieldChecks.set({ ...EMPTY_CHECKS });
        this.toastr.success('Company details saved.');
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.pendingPayload.set(null);
        this.fieldChecks.set({ ...EMPTY_CHECKS });
        this.detailsForm.enable({ emitEvent: false });
        this.financeForm.enable({ emitEvent: false });
        this.syncCountryControlLock();
        const message = this.firstError(err) ?? 'Could not save company';
        this.error.set(message);
        this.toastr.error(message);
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
    this.parentCompanyId.set(company.parent_company_id);
    this.parentBusinessName.set(company.parent_business_name);
    this.linkedCompanyRole.set(
      company.parent_company_id !== null &&
        (company.company_type === 'customer' || company.company_type === 'provider')
        ? company.company_type
        : null,
    );
    this.blockedRootCompanyTypes.set(company.blocked_root_company_types ?? []);
    if (company.parent_company_id === null) {
      this.rootCompanyType.set(company.company_type);
    }
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
    this.detailsForm.markAsPristine();
    this.detailsDirty.set(false);
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

    this.companiesApi.checkUniqueness<UniquenessCheckResponse>(body).subscribe({
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
      errors?.['company_type']?.[0] ??
      errors?.['allowed_domains']?.[0] ??
      errors?.['business_name']?.[0] ??
      errors?.['reg_number']?.[0] ??
      errors?.['gst_rate']?.[0] ??
      errors?.['email']?.[0] ??
      err.error?.message
    );
  }
}

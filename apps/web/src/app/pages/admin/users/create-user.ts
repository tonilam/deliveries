import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { User, UserRole } from '../../../core/auth/user.model';
import { Company } from '../../../core/company/company.model';

type CreateMode = 'password' | 'invite';

const COMPANY_SEARCH_MIN_CHARS = 2;
const COMPANY_SEARCH_DEBOUNCE_MS = 300;
const COMPANY_SEARCH_PAGE_SIZE = 200;

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly companySearch$ = new Subject<{ query: string; force?: boolean }>();
  private companySearchGeneration = 0;

  protected readonly mode = signal<CreateMode>('password');
  protected readonly error = signal<string | null>(null);
  protected readonly companySearchError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly companyLocked = signal(false);
  protected readonly companyQuery = signal('');
  protected readonly companySuggestions = signal<Company[]>([]);
  protected readonly companiesLoading = signal(false);
  protected readonly companyMenuOpen = signal(false);
  protected readonly activeSuggestionIndex = signal(-1);
  protected readonly selectedCompanyName = signal<string | null>(null);
  protected readonly isPasswordMode = computed(() => this.mode() === 'password');
  protected readonly isCustomerRole = signal(true);
  protected readonly activeSuggestionId = computed(() => {
    const index = this.activeSuggestionIndex();
    const company = this.companySuggestions()[index];
    return company ? `company-option-${company.id}` : null;
  });
  protected readonly companySearchHint = computed(() => {
    if (this.companyLocked()) {
      return null;
    }
    if (this.companySearchError()) {
      return this.companySearchError();
    }
    const query = this.companyQuery().trim();
    if (query.length > 0 && query.length < COMPANY_SEARCH_MIN_CHARS) {
      return `Type at least ${COMPANY_SEARCH_MIN_CHARS} characters to search.`;
    }
    if (
      this.companyMenuOpen() &&
      query.length >= COMPANY_SEARCH_MIN_CHARS &&
      !this.companiesLoading() &&
      this.companySuggestions().length === 0 &&
      this.selectedCompanyName() !== query
    ) {
      return 'No companies found.';
    }
    return null;
  });

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
    this.setupCompanySearch();

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
      this.loadLockedCompany(companyId);
    }

    this.syncCompanyValidators(this.form.controls.role.value);
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((nextRole) => {
        this.syncCompanyValidators(nextRole);
      });
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

  protected onCompanyQueryInput(event: Event): void {
    if (this.companyLocked()) {
      return;
    }

    const value = (event.target as HTMLInputElement).value;
    this.companyQuery.set(value);
    this.companyMenuOpen.set(true);
    this.activeSuggestionIndex.set(-1);
    this.companySuggestions.set([]);
    this.companySearchError.set(null);

    if (this.selectedCompanyName() !== null && value !== this.selectedCompanyName()) {
      this.selectedCompanyName.set(null);
      this.form.controls.company_id.setValue(null);
    }

    this.companySearch$.next({ query: value.trim() });
  }

  protected onCompanyFocus(): void {
    if (this.companyLocked()) {
      return;
    }

    const query = this.companyQuery().trim();
    // Keep a confirmed selection collapsed so Enter can submit the form.
    if (this.selectedCompanyName() !== null && this.selectedCompanyName() === query) {
      return;
    }

    this.companyMenuOpen.set(true);
    if (this.companySuggestions().length > 0) {
      if (this.activeSuggestionIndex() < 0) {
        this.activeSuggestionIndex.set(0);
      }
      return;
    }

    if (query.length < COMPANY_SEARCH_MIN_CHARS) {
      return;
    }

    // Force re-search on focus after a failed request even if the query text is unchanged.
    this.companySearch$.next({
      query,
      force: !!this.companySearchError(),
    });
  }

  protected onCompanyBlur(): void {
    // Delay so mousedown on a suggestion can select before the menu closes.
    window.setTimeout(() => {
      this.companyMenuOpen.set(false);
      this.activeSuggestionIndex.set(-1);
    }, 150);
  }

  protected onCompanyKeydown(event: KeyboardEvent): void {
    if (this.companyLocked()) {
      return;
    }

    const suggestions = this.companySuggestions();
    const menuExpanded = this.companyMenuOpen();
    const listVisible = menuExpanded && suggestions.length > 0;

    if (event.key === 'Escape') {
      if (menuExpanded) {
        event.preventDefault();
        this.companyMenuOpen.set(false);
        this.activeSuggestionIndex.set(-1);
      }
      return;
    }

    if (event.key === 'Enter' && menuExpanded) {
      // Avoid submitting the form while the combobox is actively searching / listing.
      event.preventDefault();
      const index = this.activeSuggestionIndex();
      if (listVisible && index >= 0 && index < suggestions.length) {
        this.selectCompany(suggestions[index]);
      }
      return;
    }

    if (!listVisible && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (suggestions.length > 0) {
        event.preventDefault();
        this.companyMenuOpen.set(true);
        this.moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    if (!listVisible) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActiveSuggestion(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveSuggestion(-1);
    }
  }

  protected selectCompany(company: Company): void {
    this.abandonCompanySearch();
    this.form.controls.company_id.setValue(company.id);
    this.selectedCompanyName.set(company.business_name);
    this.companyQuery.set(company.business_name);
    this.companySuggestions.set([]);
    this.companyMenuOpen.set(false);
    this.activeSuggestionIndex.set(-1);
    this.companySearchError.set(null);
    this.companiesLoading.set(false);
  }

  private moveActiveSuggestion(delta: number): void {
    const count = this.companySuggestions().length;
    if (count === 0) {
      this.activeSuggestionIndex.set(-1);
      return;
    }

    const current = this.activeSuggestionIndex();
    const next = current < 0 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count;
    this.activeSuggestionIndex.set(next);
    this.scrollActiveSuggestionIntoView(next);
  }

  private scrollActiveSuggestionIntoView(index: number): void {
    const company = this.companySuggestions()[index];
    if (!company) {
      return;
    }
    queueMicrotask(() => {
      document.getElementById(`company-option-${company.id}`)?.scrollIntoView({
        block: 'nearest',
      });
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

  private setupCompanySearch(): void {
    this.companySearch$
      .pipe(
        debounceTime(COMPANY_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged((prev, next) => prev.query === next.query && !next.force),
        switchMap(({ query }) => {
          const generation = ++this.companySearchGeneration;

          if (this.companyLocked() || query.length < COMPANY_SEARCH_MIN_CHARS) {
            this.companySuggestions.set([]);
            this.companiesLoading.set(false);
            return of({ generation, companies: [] as Company[] });
          }

          this.companiesLoading.set(true);
          this.companySearchError.set(null);
          const params = new HttpParams()
            .set('per_page', String(COMPANY_SEARCH_PAGE_SIZE))
            .set('filter[business_name][type]', 'startsWith')
            .set('filter[business_name][filter]', query);

          return this.http.get<{ companies: Company[] }>('/api/admin/companies', { params }).pipe(
            map((res) => ({ generation, companies: res.companies })),
            catchError(() => {
              if (generation === this.companySearchGeneration) {
                this.companySearchError.set('Unable to search companies.');
              }
              return of({ generation, companies: [] as Company[] });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ generation, companies }) => {
        if (generation !== this.companySearchGeneration) {
          return;
        }
        this.companySuggestions.set(companies);
        if (this.companyMenuOpen() && companies.length > 0) {
          this.activeSuggestionIndex.set(0);
        } else {
          this.activeSuggestionIndex.set(-1);
        }
        this.companiesLoading.set(false);
      });
  }

  private abandonCompanySearch(): void {
    this.companySearchGeneration += 1;
  }

  private loadLockedCompany(companyId: number): void {
    this.companiesLoading.set(true);
    this.http
      .get<{ company: Company }>(`/api/admin/companies/${companyId}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ company }) => {
          this.companyQuery.set(company.business_name);
          this.selectedCompanyName.set(company.business_name);
          this.companiesLoading.set(false);
        },
        error: () => {
          this.companiesLoading.set(false);
          this.companySearchError.set('Unable to load the selected company.');
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
        this.abandonCompanySearch();
        company.setValue(null);
        this.companyQuery.set('');
        this.selectedCompanyName.set(null);
        this.companySuggestions.set([]);
        this.companyMenuOpen.set(false);
        this.activeSuggestionIndex.set(-1);
        this.companySearchError.set(null);
        this.companiesLoading.set(false);
      }
    }
    company.updateValueAndValidity();
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

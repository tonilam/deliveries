import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import {
  RegistrationApiService,
  RegistrationCompanyChoice,
} from '../../core/registration/registration-api.service';
import { ToastrService } from '../../core/feedback/toastr.service';
import { SsoProvider } from '../../core/auth/user.model';

type CompanyChoice = RegistrationCompanyChoice;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly registrationApi = inject(RegistrationApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly companyChoices = signal<CompanyChoice[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
    company_id: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    const error = this.route.snapshot.queryParamMap.get('error');
    const chooseCompany = this.route.snapshot.queryParamMap.get('choose_company') === '1';

    if (email) {
      this.form.controls.email.setValue(email);
    }
    if (error) {
      this.error.set(error);
    }
    if (email && chooseCompany) {
      this.loadCompaniesForEmail(email);
    }

    this.form.controls.email.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          if (!value || this.form.controls.email.invalid) {
            this.companyChoices.set([]);
            this.form.controls.company_id.clearValidators();
            this.form.controls.company_id.setValue(null);
            this.form.controls.company_id.updateValueAndValidity({ emitEvent: false });
            return of<{ companies: CompanyChoice[] }>({ companies: [] });
          }
          return this.registrationApi.companiesForEmail(value).pipe(
            catchError((err: HttpErrorResponse) => {
              if (err.status === 429) {
                this.error.set('Too many lookups. Please wait a moment and try again.');
              }
              return of({ companies: [] as CompanyChoice[], lookupFailed: true });
            }),
          );
        }),
      )
      .subscribe((result) => {
        if (!('lookupFailed' in result && result.lookupFailed)) {
          this.applyCompanyChoices(result.companies);
        }
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
    this.auth
      .register({
        name: raw.name,
        email: raw.email,
        password: raw.password,
        password_confirmation: raw.password_confirmation,
        company_id: raw.company_id,
      })
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.toastr.success('Account created.');
          void this.router.navigateByUrl(this.auth.homePathFor(user));
        },
        error: (err: {
          error?: {
            message?: string;
            errors?: Record<string, string[]>;
            companies?: CompanyChoice[];
          };
        }) => {
          this.submitting.set(false);
          if (err.error?.companies?.length) {
            this.applyCompanyChoices(err.error.companies);
          }
          const errors = err.error?.errors;
          const message =
            errors?.['company_id']?.[0] ??
            errors?.['email']?.[0] ??
            errors?.['password']?.[0] ??
            errors?.['name']?.[0] ??
            err.error?.message ??
            'Registration failed';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected sso(provider: SsoProvider): void {
    if (this.companyChoices().length > 1 && !this.form.controls.company_id.value) {
      this.form.controls.company_id.setValidators([Validators.required]);
      this.form.controls.company_id.markAsTouched();
      this.form.controls.company_id.updateValueAndValidity();
      this.error.set('Select which company to join before continuing with SSO.');
      return;
    }

    const companyId = this.form.controls.company_id.value;
    this.auth.startSso(provider, {
      companyId: companyId ?? undefined,
    });
  }

  private loadCompaniesForEmail(email: string): void {
    this.registrationApi.companiesForEmail(email).subscribe({
      next: ({ companies }) => this.applyCompanyChoices(companies),
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) {
          this.error.set('Too many lookups. Please wait a moment and try again.');
          return;
        }
        this.companyChoices.set([]);
      },
    });
  }

  private applyCompanyChoices(companies: CompanyChoice[]): void {
    this.companyChoices.set(companies);
    const control = this.form.controls.company_id;

    if (companies.length > 1) {
      control.setValidators([Validators.required]);
      if (control.value && !companies.some((c) => c.id === control.value)) {
        control.setValue(null);
      }
    } else if (companies.length === 1) {
      control.clearValidators();
      control.setValue(companies[0].id);
    } else {
      control.clearValidators();
      control.setValue(null);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }
}

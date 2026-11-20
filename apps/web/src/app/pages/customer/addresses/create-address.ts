import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AddressRow, AddressType } from './addresses';

interface StateOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-customer-create-address',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-address.html',
  styleUrls: ['../../../shared/portal-shell.scss', './create-address.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerCreateAddress implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly stateOptions = signal<StateOption[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<AddressType>('collection', [Validators.required]),
    business_name: ['', [Validators.required, Validators.maxLength(255)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    zone: ['', [Validators.required, Validators.maxLength(255)]],
    state: ['', [Validators.required, Validators.maxLength(255)]],
    postcode: ['', [Validators.required, Validators.maxLength(32)]],
  });

  ngOnInit(): void {
    this.form.controls.state.disable({ emitEvent: false });
    this.http.get<{ states: StateOption[] }>('/api/addresses/state-options').subscribe({
      next: ({ states }) => {
        this.stateOptions.set(states);
        if (states.length === 0) {
          this.error.set('No states are configured for your company country.');
          return;
        }
        this.form.controls.state.enable({ emitEvent: false });
      },
      error: () => {
        this.error.set('Unable to load states for your company country.');
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.stateOptions().length === 0) {
      this.error.set('No states are configured for your company country.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload = this.form.getRawValue();

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.post<{ address: AddressRow }>('/api/addresses', payload)))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl('/app/addresses');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          this.error.set(this.firstError(err) ?? 'Could not save address');
        },
      });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return (
      errors?.['type']?.[0] ??
      errors?.['business_name']?.[0] ??
      errors?.['address']?.[0] ??
      errors?.['zone']?.[0] ??
      errors?.['state']?.[0] ??
      errors?.['postcode']?.[0] ??
      err.error?.message
    );
  }
}

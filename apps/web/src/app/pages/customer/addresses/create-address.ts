import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AddressRow, AddressType } from './addresses';

@Component({
  selector: 'app-customer-create-address',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-address.html',
  styleUrls: ['../../../shared/portal-shell.scss', './create-address.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerCreateAddress {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<AddressType>('collection', [Validators.required]),
    business_name: ['', [Validators.required, Validators.maxLength(255)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    zone: ['', [Validators.required, Validators.maxLength(255)]],
    state: ['', [Validators.required, Validators.maxLength(255)]],
    postcode: ['', [Validators.required, Validators.maxLength(32)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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

import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AddressRow, AddressType } from './addresses';

interface StateOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-customer-address-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './address-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './address-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly stateOptions = signal<StateOption[]>([]);
  protected readonly addressId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.addressId() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit address' : 'Add address'));

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

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id < 1) {
        this.error.set('Invalid address.');
        this.loadFailed.set(true);
        return;
      }
      this.addressId.set(id);
      this.loading.set(true);
    }

    const addressId = this.addressId();
    forkJoin({
      states: this.http.get<{ states: StateOption[] }>('/api/addresses/state-options'),
      address: addressId
        ? this.http.get<{ address: AddressRow }>(`/api/addresses/${addressId}`)
        : of(null),
    }).subscribe({
      next: ({ states, address }) => {
        this.stateOptions.set(states.states);
        if (states.states.length === 0) {
          this.error.set('No states are configured for your company country.');
        } else {
          this.form.controls.state.enable({ emitEvent: false });
        }

        if (address) {
          this.form.patchValue({
            type: address.address.type,
            business_name: address.address.business_name,
            address: address.address.address,
            zone: address.address.zone,
            state: address.address.state,
            postcode: address.address.postcode,
          });
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          addressId ? 'Unable to load address.' : 'Unable to load states for your company country.',
        );
        this.loadFailed.set(addressId !== null);
        this.loading.set(false);
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
    const addressId = this.addressId();
    const request$ =
      addressId === null
        ? this.http.post<{ address: AddressRow }>('/api/addresses', payload)
        : this.http.put<{ address: AddressRow }>(`/api/addresses/${addressId}`, payload);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
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

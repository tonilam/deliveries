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
import { ToastrService } from '../../../core/feedback/toastr.service';
import {
  RadioCardGroupComponent,
  RadioCardOption,
} from '../../../shared/radio-card-group/radio-card-group';
import { AddressRow, AddressType } from './addresses';

const TYPE_OPTIONS: RadioCardOption[] = [
  { value: 'collection', label: 'Collection' },
  { value: 'delivery', label: 'Delivery' },
];

interface StateOption {
  code: string;
  name: string;
}

interface ZoneOption {
  id: number;
  name: string;
  code: string;
}

const ZONE_SEARCH_MIN_CHARS = 2;
const ZONE_SUGGESTION_LIMIT = 200;

@Component({
  selector: 'app-customer-address-form',
  imports: [ReactiveFormsModule, RouterLink, RadioCardGroupComponent],
  templateUrl: './address-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './address-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly stateOptions = signal<StateOption[]>([]);
  protected readonly zoneOptions = signal<ZoneOption[]>([]);
  protected readonly zoneCatalogReady = signal(false);
  protected readonly zoneQuery = signal('');
  protected readonly zoneSuggestions = signal<ZoneOption[]>([]);
  protected readonly zoneMenuOpen = signal(false);
  protected readonly activeZoneSuggestionIndex = signal(-1);
  protected readonly selectedZoneName = signal<string | null>(null);
  protected readonly addressId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.addressId() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit address' : 'Add address'));
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly activeZoneSuggestionId = computed(() => {
    const index = this.activeZoneSuggestionIndex();
    const zone = this.zoneSuggestions()[index];
    return zone ? `zone-option-${zone.id}` : null;
  });
  protected readonly zoneSearchHint = computed(() => {
    if (!this.zoneCatalogReady()) {
      return null;
    }
    const query = this.zoneQuery().trim();
    if (query.length > 0 && query.length < ZONE_SEARCH_MIN_CHARS) {
      return `Type at least ${ZONE_SEARCH_MIN_CHARS} characters to search.`;
    }
    if (
      this.zoneMenuOpen() &&
      query.length >= ZONE_SEARCH_MIN_CHARS &&
      this.zoneSuggestions().length === 0 &&
      this.selectedZoneName() !== query
    ) {
      return 'No zones found.';
    }
    return null;
  });

  protected readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<AddressType>('collection', [Validators.required]),
    business_name: ['', [Validators.required, Validators.maxLength(255)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    zone_id: this.fb.control<number | null>(null, [Validators.required]),
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
      zones: this.http.get<{ zones: ZoneOption[] }>('/api/addresses/zone-options'),
      address: addressId
        ? this.http.get<{ address: AddressRow }>(`/api/addresses/${addressId}`)
        : of(null),
    }).subscribe({
      next: ({ states, zones, address }) => {
        this.stateOptions.set(states.states);
        this.zoneOptions.set(zones.zones);
        this.zoneCatalogReady.set(zones.zones.length > 0);

        const loadError =
          states.states.length === 0
            ? 'No states are configured for your company country.'
            : zones.zones.length === 0
              ? 'No zones are configured for your company country.'
              : null;

        if (loadError !== null) {
          this.error.set(loadError);
        } else {
          this.form.controls.state.enable({ emitEvent: false });
        }

        if (address) {
          this.form.patchValue({
            type: address.address.type,
            business_name: address.address.business_name,
            address: address.address.address,
            zone_id: address.address.zone_id,
            state: address.address.state,
            postcode: address.address.postcode,
          });
          this.selectedZoneName.set(address.address.zone);
          this.zoneQuery.set(address.address.zone);
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          addressId
            ? 'Unable to load address.'
            : 'Unable to load states and zones for your company country.',
        );
        this.loadFailed.set(addressId !== null);
        this.loading.set(false);
      },
    });
  }

  protected onZoneQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.zoneQuery.set(value);
    this.zoneMenuOpen.set(true);
    this.activeZoneSuggestionIndex.set(-1);
    this.refreshZoneSuggestions(value);

    if (this.selectedZoneName() !== null && value !== this.selectedZoneName()) {
      this.selectedZoneName.set(null);
      this.form.controls.zone_id.setValue(null);
    }
  }

  protected onZoneFocus(): void {
    const query = this.zoneQuery().trim();
    if (this.selectedZoneName() !== null && this.selectedZoneName() === query) {
      return;
    }

    this.zoneMenuOpen.set(true);
    this.refreshZoneSuggestions(query);

    if (this.zoneSuggestions().length > 0 && this.activeZoneSuggestionIndex() < 0) {
      this.activeZoneSuggestionIndex.set(0);
    }
  }

  protected onZoneBlur(): void {
    window.setTimeout(() => {
      this.zoneMenuOpen.set(false);
      this.activeZoneSuggestionIndex.set(-1);
    }, 150);
  }

  protected onZoneKeydown(event: KeyboardEvent): void {
    const suggestions = this.zoneSuggestions();
    const menuExpanded = this.zoneMenuOpen();
    const listVisible = menuExpanded && suggestions.length > 0;

    if (event.key === 'Escape') {
      if (menuExpanded) {
        event.preventDefault();
        this.zoneMenuOpen.set(false);
        this.activeZoneSuggestionIndex.set(-1);
      }
      return;
    }

    if (event.key === 'Enter' && menuExpanded) {
      event.preventDefault();
      const index = this.activeZoneSuggestionIndex();
      if (listVisible && index >= 0 && index < suggestions.length) {
        this.selectZone(suggestions[index]);
      }
      return;
    }

    if (!listVisible && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (suggestions.length > 0) {
        event.preventDefault();
        this.zoneMenuOpen.set(true);
        this.moveActiveZoneSuggestion(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    if (!listVisible) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActiveZoneSuggestion(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveZoneSuggestion(-1);
    }
  }

  protected selectZone(zone: ZoneOption): void {
    this.form.controls.zone_id.setValue(zone.id);
    this.selectedZoneName.set(zone.name);
    this.zoneQuery.set(zone.name);
    this.zoneSuggestions.set([]);
    this.zoneMenuOpen.set(false);
    this.activeZoneSuggestionIndex.set(-1);
    this.form.controls.zone_id.markAsTouched();
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

    if (this.zoneOptions().length === 0) {
      this.error.set('No zones are configured for your company country.');
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
          const created = addressId === null;
          this.toastr.success(created ? 'Address created.' : 'Address updated.');
          void this.router.navigateByUrl('/app/addresses');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          const message = this.firstError(err) ?? 'Could not save address';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  private refreshZoneSuggestions(query: string): void {
    const trimmed = query.trim();
    if (trimmed.length < ZONE_SEARCH_MIN_CHARS) {
      this.zoneSuggestions.set([]);
      return;
    }

    const needle = trimmed.toLowerCase();
    const matches = this.zoneOptions().filter(
      (zone) =>
        zone.name.toLowerCase().includes(needle) || zone.code.toLowerCase().includes(needle),
    );

    this.zoneSuggestions.set(matches.slice(0, ZONE_SUGGESTION_LIMIT));
    if (this.zoneMenuOpen() && matches.length > 0 && this.activeZoneSuggestionIndex() < 0) {
      this.activeZoneSuggestionIndex.set(0);
    }
  }

  private moveActiveZoneSuggestion(delta: number): void {
    const count = this.zoneSuggestions().length;
    if (count === 0) {
      this.activeZoneSuggestionIndex.set(-1);
      return;
    }

    const current = this.activeZoneSuggestionIndex();
    const next = current < 0 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count;
    this.activeZoneSuggestionIndex.set(next);
    this.scrollActiveZoneSuggestionIntoView(next);
  }

  private scrollActiveZoneSuggestionIntoView(index: number): void {
    const zone = this.zoneSuggestions()[index];
    if (!zone) {
      return;
    }
    queueMicrotask(() => {
      document.getElementById(`zone-option-${zone.id}`)?.scrollIntoView({
        block: 'nearest',
      });
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
      errors?.['zone_id']?.[0] ??
      errors?.['state']?.[0] ??
      errors?.['postcode']?.[0] ??
      err.error?.message
    );
  }
}

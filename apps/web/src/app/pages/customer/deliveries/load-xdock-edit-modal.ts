import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, of, Subject } from 'rxjs';

import { LoadsApiService } from '../../../core/loads/loads-api.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { UiAutocompleteFieldComponent } from '../../../shared/ui/autocomplete-field/autocomplete-field';
import { LoadActivityPanel } from './load-activity-panel';
import { LoadScheduleFields } from './load-schedule-fields';
import { loadScheduleControls, loadScheduleOrderValidator } from './load-schedule';
import { LoadRow } from './load.types';

const SEARCH_MIN_CHARS = 2;
const PARTY_BROWSE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface PartyOption {
  id: number;
  business_name: string;
}

interface AddressOption {
  id: number;
  label: string;
  business_name: string;
}

type AddressField = 'x_dock_delivery' | 'x_dock_xdock';

interface PickerState {
  query: string;
  selectedLabel: string | null;
  options: PartyOption[] | AddressOption[];
  menuOpen: boolean;
  loading: boolean;
}

const emptyPicker = (): PickerState => ({
  query: '',
  selectedLabel: null,
  options: [],
  menuOpen: false,
  loading: false,
});

@Component({
  selector: 'app-load-xdock-edit-modal',
  imports: [
    ReactiveFormsModule,
    LoadActivityPanel,
    LoadScheduleFields,
    UiAutocompleteFieldComponent,
  ],
  templateUrl: './load-xdock-edit-modal.html',
  styleUrl: './load-xdock-edit-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadXDockEditModal {
  private readonly loadsApi = inject(LoadsApiService);
  private readonly toastr = inject(ToastrService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly partySearch$ = new Subject<string>();
  private readonly addressSearch$ = new Subject<{ field: AddressField; query: string }>();
  private partySearchGeneration = 0;
  private addressSearchGeneration = 0;

  readonly load = input.required<LoadRow>();
  readonly closed = output<void>();
  readonly saved = output<LoadRow>();

  protected readonly submitting = signal(false);
  protected readonly activityRefresh = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly partyPicker = signal<PickerState>(emptyPicker());
  protected readonly addressPickers = signal<Record<AddressField, PickerState>>({
    x_dock_delivery: emptyPicker(),
    x_dock_xdock: emptyPicker(),
  });

  protected readonly form = this.fb.group(
    {
      xdock_address_id: this.fb.control<number | null>(null, [Validators.required]),
      delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
      secondary_provider_company_id: this.fb.control<number | null>(null, [Validators.required]),
      pallet_count: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      ...loadScheduleControls(this.fb),
    },
    { validators: loadScheduleOrderValidator() },
  );

  constructor() {
    effect(() => {
      const row = this.load();
      this.form.patchValue({
        xdock_address_id: row.xdock_address_id,
        delivery_address_id: row.delivery_address_id,
        secondary_provider_company_id: row.secondary_provider_company_id,
        pallet_count: row.pallet_count,
        pickup_date: row.pickup_date,
        pickup_time: row.pickup_time,
        dropoff_date: row.dropoff_date,
        dropoff_time: row.dropoff_time,
      });
      this.addressPickers.set({
        x_dock_delivery: {
          ...emptyPicker(),
          query: row.delivery ?? '',
          selectedLabel: row.delivery,
        },
        x_dock_xdock: {
          ...emptyPicker(),
          query: row.xdock ?? '',
          selectedLabel: row.xdock,
        },
      });
      this.partyPicker.set({
        ...emptyPicker(),
        query: row.secondary_provider ?? '',
        selectedLabel: row.secondary_provider,
      });
      this.error.set(null);
    });

    this.setupSearchStreams();
  }

  protected cancel(): void {
    if (!this.submitting()) {
      this.closed.emit();
    }
  }

  protected partyState(): PickerState {
    return this.partyPicker();
  }

  protected addressState(field: AddressField): PickerState {
    return this.addressPickers()[field];
  }

  protected onPartyQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.partyPicker.update((s) => ({ ...s, query: value, menuOpen: true }));
    if (this.partyPicker().selectedLabel !== null && value !== this.partyPicker().selectedLabel) {
      this.form.controls.secondary_provider_company_id.setValue(null);
      this.partyPicker.update((s) => ({ ...s, selectedLabel: null }));
    }
    this.partySearch$.next(value);
  }

  protected onPartyFocus(): void {
    this.partyPicker.update((s) => ({ ...s, menuOpen: true }));
    this.partySearch$.next(this.partyPicker().query);
  }

  protected onPartyBlur(): void {
    setTimeout(() => this.partyPicker.update((s) => ({ ...s, menuOpen: false })), 150);
  }

  protected clearPartyPicker(): void {
    this.form.controls.secondary_provider_company_id.setValue(null);
    this.partyPicker.set(emptyPicker());
  }

  protected selectParty(option: PartyOption): void {
    this.form.controls.secondary_provider_company_id.setValue(option.id);
    this.partyPicker.set({
      query: option.business_name,
      selectedLabel: option.business_name,
      options: [],
      menuOpen: false,
      loading: false,
    });
  }

  protected onAddressQueryInput(field: AddressField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateAddressPicker(field, { query: value, menuOpen: true });
    const picker = this.addressPickers()[field];
    if (picker.selectedLabel !== null && value !== picker.selectedLabel) {
      this.addressControl(field)?.setValue(null);
      this.updateAddressPicker(field, { selectedLabel: null });
    }
    this.addressSearch$.next({ field, query: value });
  }

  protected onAddressFocus(field: AddressField): void {
    this.updateAddressPicker(field, { menuOpen: true });
    this.addressSearch$.next({ field, query: this.addressPickers()[field].query });
  }

  protected onAddressBlur(field: AddressField): void {
    setTimeout(() => this.updateAddressPicker(field, { menuOpen: false }), 150);
  }

  protected clearAddressPicker(field: AddressField): void {
    this.addressControl(field)?.setValue(null);
    this.updateAddressPicker(field, emptyPicker());
  }

  protected selectAddress(field: AddressField, option: AddressOption): void {
    this.addressControl(field)?.setValue(option.id);
    this.updateAddressPicker(field, {
      query: option.label,
      selectedLabel: option.label,
      menuOpen: false,
      options: [],
    });
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      delivery_address_id: raw.delivery_address_id!,
      xdock_address_id: raw.xdock_address_id!,
      secondary_provider_company_id: raw.secondary_provider_company_id!,
      pallet_count: raw.pallet_count,
      pickup_date: String(raw.pickup_date ?? ''),
      pickup_time: String(raw.pickup_time ?? ''),
      dropoff_date: String(raw.dropoff_date ?? ''),
      dropoff_time: String(raw.dropoff_time ?? ''),
    };

    const loadId = this.load().id;
    this.submitting.set(true);
    this.error.set(null);

    this.loadsApi.update(loadId, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.activityRefresh.update((n) => n + 1);
        this.toastr.success('X Dock load updated.');
        this.saved.emit(res.load);
        this.closed.emit();
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        const message = this.firstError(err) ?? 'Unable to update X Dock load.';
        this.error.set(message);
        this.toastr.error(message);
      },
    });
  }

  private addressControl(field: AddressField) {
    if (field === 'x_dock_delivery') {
      return this.form.controls.delivery_address_id;
    }
    return this.form.controls.xdock_address_id;
  }

  private updateAddressPicker(field: AddressField, patch: Partial<PickerState>): void {
    this.addressPickers.update((state) => ({
      ...state,
      [field]: { ...state[field], ...patch },
    }));
  }

  private setupSearchStreams(): void {
    this.partySearch$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        const trimmed = query.trim();
        const generation = ++this.partySearchGeneration;
        this.partyPicker.update((s) => ({ ...s, loading: true }));

        let params = new HttpParams().set('party_type', 'provider');
        const browseOnly = trimmed.length < SEARCH_MIN_CHARS;
        if (!browseOnly) {
          params = params.set('q', trimmed);
        }

        this.loadsApi
          .getPartyOptions<{ companies: PartyOption[] }>(params)
          .pipe(catchError(() => of({ companies: [] })))
          .subscribe((res) => {
            if (generation !== this.partySearchGeneration) {
              return;
            }
            const companies = browseOnly
              ? res.companies.slice(0, PARTY_BROWSE_LIMIT)
              : res.companies;
            this.partyPicker.update((s) => ({ ...s, options: companies, loading: false }));
          });
      });

    this.addressSearch$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ field, query }) => {
        const trimmed = query.trim();
        if (trimmed.length > 0 && trimmed.length < SEARCH_MIN_CHARS) {
          this.updateAddressPicker(field, { options: [], loading: false });
          return;
        }

        const generation = ++this.addressSearchGeneration;
        this.updateAddressPicker(field, { loading: true });

        let params = new HttpParams().set('address_type', 'delivery');
        if (trimmed.length >= SEARCH_MIN_CHARS) {
          params = params.set('q', trimmed);
        }

        this.loadsApi
          .getAddressOptions<{ addresses: AddressOption[] }>(params)
          .pipe(catchError(() => of({ addresses: [] })))
          .subscribe((res) => {
            if (generation !== this.addressSearchGeneration) {
              return;
            }
            this.updateAddressPicker(field, { options: res.addresses, loading: false });
          });
      });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | null {
    const errors = err.error?.errors;
    if (errors) {
      const firstKey = Object.keys(errors)[0];
      if (firstKey && errors[firstKey]?.[0]) {
        return errors[firstKey][0];
      }
    }
    if (typeof err.error?.message === 'string') {
      return err.error.message;
    }
    return null;
  }
}

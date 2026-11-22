import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, forkJoin, of, Subject, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import { LoadScheduleFields } from './load-schedule-fields';
import { loadScheduleControls, loadScheduleOrderValidator } from './load-schedule';
import { LoadXDockEditModal } from './load-xdock-edit-modal';
import {
  VehicleBodyTypeOptionDefinition,
  VehicleBodyTypeOptionRow,
} from '../../../core/vehicle/vehicle.model';
import { LoadRow, LoadType, OwnerCompanyType } from './load.types';

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

type PartyField = 'customer' | 'provider' | 'secondary_provider';
type AddressField =
  'collection' | 'delivery' | 'xdock' | 'add_drop_delivery' | 'x_dock_delivery' | 'x_dock_xdock';
type PartyPickerKey = PartyField | 'x_dock_secondary';

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
  selector: 'app-customer-load-form',
  imports: [ReactiveFormsModule, RouterLink, LoadScheduleFields, LoadXDockEditModal],
  templateUrl: './load-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './load-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerLoadForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly partySearch$ = new Subject<{ field: PartyPickerKey; query: string }>();
  private readonly addressSearch$ = new Subject<{ field: AddressField; query: string }>();
  private partySearchGeneration = 0;
  private addressSearchGeneration = 0;

  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly childSubmitting = signal(false);
  protected readonly loadId = signal<number | null>(null);
  protected readonly loadType = signal<LoadType | null>(null);
  protected readonly ownCompanyType = signal<OwnerCompanyType | null>(null);
  protected readonly children = signal<LoadRow[]>([]);
  protected readonly editingXDockChild = signal<LoadRow | null>(null);
  protected readonly truckTypeCatalogue = signal<VehicleBodyTypeOptionRow[]>([]);
  protected readonly truckTypePicker = signal<PickerState>(emptyPicker());
  protected readonly vehicleOptionValues = signal<Record<string, string | boolean>>({});

  protected readonly partyPickers = signal<Record<PartyPickerKey, PickerState>>({
    customer: emptyPicker(),
    provider: emptyPicker(),
    secondary_provider: emptyPicker(),
    x_dock_secondary: emptyPicker(),
  });

  protected readonly addressPickers = signal<Record<AddressField, PickerState>>({
    collection: emptyPicker(),
    delivery: emptyPicker(),
    xdock: emptyPicker(),
    add_drop_delivery: emptyPicker(),
    x_dock_delivery: emptyPicker(),
    x_dock_xdock: emptyPicker(),
  });

  protected readonly isEdit = computed(() => this.loadId() !== null);
  protected readonly isDirectEdit = computed(() => this.isEdit() && this.loadType() === 'direct');
  protected readonly isChildEdit = computed(
    () => this.isEdit() && this.loadType() !== null && this.loadType() !== 'direct',
  );
  protected readonly isAddDropEdit = computed(
    () => this.isChildEdit() && this.loadType() === 'add_drop',
  );
  protected readonly showCustomerPicker = computed(
    () => this.ownCompanyType() !== 'customer' && !this.isChildEdit(),
  );
  protected readonly showProviderPicker = computed(
    () => this.ownCompanyType() !== 'provider' && !this.isChildEdit(),
  );
  protected readonly showXDockChildForm = computed(() => this.ownCompanyType() !== 'provider');
  protected readonly filteredTruckTypes = computed(() => {
    const query = this.truckTypePicker().query.trim().toLowerCase();
    const rows = this.truckTypeOptions();
    if (query === '') {
      return rows;
    }
    return rows.filter((row) => this.truckTypeLabel(row).toLowerCase().includes(query));
  });

  protected readonly selectedTruckTypeOptions = computed((): VehicleBodyTypeOptionDefinition[] => {
    const id = this.directForm.controls.vehicle_body_type_id.value;
    if (id === null) {
      return [];
    }
    const row = this.truckTypeOptions().find((item) => item.id === id);
    return row?.options ?? [];
  });

  protected readonly showTruckTypeClear = computed(
    () => this.truckTypePicker().query.trim() !== '',
  );

  protected readonly title = computed(() => {
    if (!this.isEdit()) {
      return 'Create load';
    }
    if (this.loadType() === 'add_drop') {
      return 'Edit Add Drop';
    }
    if (this.loadType() === 'x_dock') {
      return 'Edit X Dock';
    }
    return 'Edit load';
  });

  protected readonly directForm = this.fb.group(
    {
      customer_company_id: this.fb.control<number | null>(null),
      provider_company_id: this.fb.control<number | null>(null),
      collection_address_id: this.fb.control<number | null>(null, [Validators.required]),
      delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
      vehicle_body_type_id: this.fb.control<number | null>(null),
      pallet_count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
      ...loadScheduleControls(this.fb),
    },
    { validators: loadScheduleOrderValidator() },
  );

  protected readonly childEditForm = this.fb.group(
    {
      delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
      xdock_address_id: this.fb.control<number | null>(null),
      secondary_provider_company_id: this.fb.control<number | null>(null),
      pallet_count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
      ...loadScheduleControls(this.fb),
    },
    { validators: loadScheduleOrderValidator() },
  );

  protected readonly addDropForm = this.fb.group(
    {
      delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
      pallet_count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
      ...loadScheduleControls(this.fb),
    },
    { validators: loadScheduleOrderValidator() },
  );

  protected readonly xDockForm = this.fb.group(
    {
      delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
      xdock_address_id: this.fb.control<number | null>(null, [Validators.required]),
      secondary_provider_company_id: this.fb.control<number | null>(null, [Validators.required]),
      pallet_count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
      ...loadScheduleControls(this.fb),
    },
    { validators: loadScheduleOrderValidator() },
  );

  ngOnInit(): void {
    this.setupSearchStreams();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id < 1) {
        this.error.set('Invalid load.');
        this.loadFailed.set(true);
        return;
      }
      this.loadId.set(id);
      this.loading.set(true);
    } else {
      this.loading.set(true);
    }

    const loadId = this.loadId();
    const load$ = loadId
      ? this.http.get<{ load: LoadRow; own_company_type: OwnerCompanyType }>(`/api/loads/${loadId}`)
      : of(null);
    const meta$ = loadId
      ? of(null)
      : this.http.get<{ meta: { own_company_type?: OwnerCompanyType } }>('/api/loads', {
          params: new HttpParams().set('page', '1').set('per_page', '10'),
        });
    const bodyTypes$ = this.http
      .get<{ vehicle_body_types: VehicleBodyTypeOptionRow[] }>('/api/vehicles/body-type-options')
      .pipe(catchError(() => of({ vehicle_body_types: [] as VehicleBodyTypeOptionRow[] })));

    forkJoin({ meta: meta$, load: load$, bodyTypes: bodyTypes$ }).subscribe({
      next: ({ meta, load, bodyTypes }) => {
        this.truckTypeCatalogue.set(bodyTypes.vehicle_body_types);
        const ownerType = load?.own_company_type ?? meta?.meta.own_company_type ?? null;
        this.ownCompanyType.set(ownerType);
        this.syncDirectValidators(ownerType);

        if (load) {
          const row = load.load;
          if (row.type === 'x_dock') {
            this.loading.set(false);
            void this.router.navigate(['/app/deliveries'], {
              queryParams: { edit_load: String(row.id) },
            });
            return;
          }

          this.loadType.set(row.type);
          if (row.type === 'direct') {
            this.children.set(row.children ?? []);
            this.directForm.patchValue({
              customer_company_id: row.customer_company_id,
              provider_company_id: row.provider_company_id,
              collection_address_id: row.collection_address_id,
              delivery_address_id: row.delivery_address_id,
              pallet_count: row.pallet_count,
              pickup_date: row.pickup_date,
              pickup_time: row.pickup_time,
              dropoff_date: row.dropoff_date,
              dropoff_time: row.dropoff_time,
              vehicle_body_type_id: row.vehicle_body_type_id,
            });
            this.syncTruckTypeFromLoad(row, bodyTypes.vehicle_body_types);
            this.setPartyLabel('customer', row.customer);
            this.setPartyLabel('provider', row.provider);
            this.setAddressLabel('collection', row.collection);
            this.setAddressLabel('delivery', row.delivery);
          } else {
            this.childEditForm.patchValue({
              delivery_address_id: row.delivery_address_id,
              xdock_address_id: row.xdock_address_id,
              secondary_provider_company_id: row.secondary_provider_company_id,
              pallet_count: row.pallet_count,
              pickup_date: row.pickup_date,
              pickup_time: row.pickup_time,
              dropoff_date: row.dropoff_date,
              dropoff_time: row.dropoff_time,
            });
            this.setAddressLabel('delivery', row.delivery);
            this.setAddressLabel('xdock', row.xdock);
            this.setPartyLabel('secondary_provider', row.secondary_provider);
          }
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set(loadId ? 'Unable to load delivery.' : 'Unable to start form.');
        this.loadFailed.set(loadId !== null);
        this.loading.set(false);
      },
    });
  }

  protected partyState(field: PartyPickerKey): PickerState {
    return this.partyPickers()[field];
  }

  protected addressState(field: AddressField): PickerState {
    return this.addressPickers()[field];
  }

  protected truckTypeLabel(row: VehicleBodyTypeOptionRow): string {
    const category = row.category_name?.trim() ?? '';
    if (category !== '') {
      return `${category} \\ ${row.name}`;
    }
    return row.name;
  }

  protected truckTypeValue(key: string): string | boolean {
    return this.vehicleOptionValues()[key] ?? '';
  }

  protected onTruckTypeQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.truckTypePicker.update((state) => ({ ...state, query: value, menuOpen: true }));
    if (
      this.truckTypePicker().selectedLabel !== null &&
      value !== this.truckTypePicker().selectedLabel
    ) {
      this.directForm.controls.vehicle_body_type_id.setValue(null);
      this.vehicleOptionValues.set({});
      this.truckTypePicker.update((state) => ({ ...state, selectedLabel: null }));
    }
  }

  protected onTruckTypeFocus(): void {
    this.truckTypePicker.update((state) => ({ ...state, menuOpen: true }));
  }

  protected onTruckTypeBlur(): void {
    setTimeout(() => this.truckTypePicker.update((state) => ({ ...state, menuOpen: false })), 150);
  }

  protected clearTruckType(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.directForm.controls.vehicle_body_type_id.setValue(null);
    this.vehicleOptionValues.set({});
    this.truckTypePicker.set(emptyPicker());
  }

  protected selectTruckType(row: VehicleBodyTypeOptionRow): void {
    this.directForm.controls.vehicle_body_type_id.setValue(row.id);
    const initial: Record<string, string | boolean> = {};
    for (const option of row.options ?? []) {
      initial[option.key] = option.data_type === 'boolean' ? false : '';
    }
    this.vehicleOptionValues.set(initial);
    const label = this.truckTypeLabel(row);
    this.truckTypePicker.set({
      query: label,
      selectedLabel: label,
      options: [],
      menuOpen: false,
      loading: false,
    });
  }

  protected setVehicleOptionVarchar(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.vehicleOptionValues.update((current) => ({ ...current, [key]: value }));
  }

  protected setVehicleOptionBoolean(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.vehicleOptionValues.update((current) => ({ ...current, [key]: checked }));
  }

  protected onPartyQueryInput(field: PartyPickerKey, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updatePartyPicker(field, { query: value, menuOpen: true });
    if (
      this.partyPickers()[field].selectedLabel !== null &&
      value !== this.partyPickers()[field].selectedLabel
    ) {
      this.clearPartyValue(field);
    }
    this.partySearch$.next({ field, query: value });
  }

  protected onPartyFocus(field: PartyPickerKey): void {
    this.updatePartyPicker(field, { menuOpen: true });
    this.partySearch$.next({ field, query: this.partyPickers()[field].query });
  }

  protected onPartyBlur(field: PartyPickerKey): void {
    setTimeout(() => this.updatePartyPicker(field, { menuOpen: false }), 150);
  }

  protected selectParty(
    field: PartyPickerKey,
    option: PartyOption,
    target: 'direct' | 'child' | 'x_dock' = 'direct',
  ): void {
    const control =
      field === 'customer'
        ? this.directForm.controls.customer_company_id
        : field === 'provider'
          ? this.directForm.controls.provider_company_id
          : target === 'x_dock' || field === 'x_dock_secondary'
            ? this.xDockForm.controls.secondary_provider_company_id
            : this.childEditForm.controls.secondary_provider_company_id;

    control.setValue(option.id);
    this.updatePartyPicker(field, {
      query: option.business_name,
      selectedLabel: option.business_name,
      menuOpen: false,
      options: [],
    });
  }

  protected onAddressQueryInput(
    field: AddressField,
    event: Event,
    form: 'direct' | 'child' | 'add_drop' | 'x_dock',
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateAddressPicker(field, { query: value, menuOpen: true });
    if (
      this.addressPickers()[field].selectedLabel !== null &&
      value !== this.addressPickers()[field].selectedLabel
    ) {
      this.clearAddressValue(field, form);
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

  protected selectAddress(
    field: AddressField,
    option: AddressOption,
    form: 'direct' | 'child' | 'add_drop' | 'x_dock',
  ): void {
    const control = this.addressControl(field, form);
    control?.setValue(option.id);
    this.updateAddressPicker(field, {
      query: option.label,
      selectedLabel: option.label,
      menuOpen: false,
      options: [],
    });
  }

  protected submitDirect(): void {
    const form = this.isChildEdit() ? this.childEditForm : this.directForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const id = this.loadId();
    const payload = this.isChildEdit() ? this.childEditPayload() : this.directLoadPayload();

    const request$ =
      id === null
        ? this.http.post<{ load: LoadRow }>('/api/loads', payload)
        : this.http.put<{ load: LoadRow }>(`/api/loads/${id}`, payload);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toastr.success(id === null ? 'Load created.' : 'Load updated.');
          if (id === null) {
            void this.router.navigate(['/app/deliveries', res.load.id, 'edit']);
          } else if (res.load.type === 'direct') {
            this.children.set(res.load.children ?? []);
          }
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          const message = this.firstError(err) ?? 'Unable to save load.';
          this.error.set(message);
          this.toastr.error(message);
          this.submitting.set(false);
        },
      });
  }

  protected openXDockEdit(child: LoadRow): void {
    this.editingXDockChild.set(child);
  }

  protected closeXDockEdit(): void {
    this.editingXDockChild.set(null);
  }

  protected onXDockChildSaved(updated: LoadRow): void {
    this.children.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
  }

  protected submitAddDropChild(): void {
    this.submitChild('add_drop');
  }

  protected submitXDockChild(): void {
    this.submitChild('x_dock');
  }

  private directLoadPayload(): Record<string, unknown> {
    const raw = this.directForm.getRawValue();
    const bodyTypeId = raw.vehicle_body_type_id;
    let vehicle_option_values: Record<string, string | boolean> | null = null;
    if (bodyTypeId !== null) {
      const values = this.vehicleOptionValues();
      vehicle_option_values = Object.keys(values).length > 0 ? { ...values } : null;
    }

    return {
      customer_company_id: raw.customer_company_id,
      provider_company_id: raw.provider_company_id,
      collection_address_id: raw.collection_address_id,
      delivery_address_id: raw.delivery_address_id,
      pallet_count: raw.pallet_count,
      pickup_date: raw.pickup_date,
      pickup_time: raw.pickup_time,
      dropoff_date: raw.dropoff_date,
      dropoff_time: raw.dropoff_time,
      vehicle_body_type_id: bodyTypeId,
      vehicle_option_values,
    };
  }

  private childEditPayload(): Record<string, number | string | null> {
    const raw = this.childEditForm.getRawValue();
    const payload: Record<string, number | string | null> = {
      delivery_address_id: raw.delivery_address_id,
      pallet_count: raw.pallet_count,
      ...this.schedulePayload(this.childEditForm),
    };
    if (this.loadType() === 'x_dock') {
      payload['xdock_address_id'] = raw.xdock_address_id;
      payload['secondary_provider_company_id'] = raw.secondary_provider_company_id;
    }
    return payload;
  }

  private schedulePayload(form: FormGroup): Record<string, string> {
    return {
      pickup_date: String(form.get('pickup_date')?.value ?? ''),
      pickup_time: String(form.get('pickup_time')?.value ?? ''),
      dropoff_date: String(form.get('dropoff_date')?.value ?? ''),
      dropoff_time: String(form.get('dropoff_time')?.value ?? ''),
    };
  }

  private submitChild(type: 'add_drop' | 'x_dock'): void {
    const form = type === 'add_drop' ? this.addDropForm : this.xDockForm;
    if (form.invalid || this.childSubmitting()) {
      form.markAllAsTouched();
      return;
    }

    const parentId = this.loadId();
    if (parentId === null) {
      return;
    }

    this.childSubmitting.set(true);
    this.error.set(null);

    const childForm = type === 'add_drop' ? this.addDropForm : this.xDockForm;
    const payload =
      type === 'add_drop'
        ? {
            type,
            delivery_address_id: this.addDropForm.controls.delivery_address_id.value,
            pallet_count: this.addDropForm.controls.pallet_count.value,
            ...this.schedulePayload(childForm),
          }
        : {
            type,
            delivery_address_id: this.xDockForm.controls.delivery_address_id.value,
            pallet_count: this.xDockForm.controls.pallet_count.value,
            xdock_address_id: this.xDockForm.controls.xdock_address_id.value,
            secondary_provider_company_id:
              this.xDockForm.controls.secondary_provider_company_id.value,
            ...this.schedulePayload(childForm),
          };

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<{ load: LoadRow }>(`/api/loads/${parentId}/children`, payload),
        ),
      )
      .subscribe({
        next: () => {
          this.childSubmitting.set(false);
          this.toastr.success('Child load created.');
          if (type === 'add_drop') {
            this.addDropForm.reset({ pallet_count: 1, delivery_address_id: null });
            this.updateAddressPicker('add_drop_delivery', emptyPicker());
          } else {
            this.xDockForm.reset({
              pallet_count: 1,
              delivery_address_id: null,
              xdock_address_id: null,
              secondary_provider_company_id: null,
            });
            this.updateAddressPicker('x_dock_delivery', emptyPicker());
            this.updateAddressPicker('x_dock_xdock', emptyPicker());
            this.updatePartyPicker('x_dock_secondary', emptyPicker());
          }
          this.refreshDirectLoad(parentId);
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          const message = this.firstError(err) ?? 'Unable to create child load.';
          this.error.set(message);
          this.toastr.error(message);
          this.childSubmitting.set(false);
        },
      });
  }

  private refreshDirectLoad(id: number): void {
    this.http.get<{ load: LoadRow }>(`/api/loads/${id}`).subscribe({
      next: (res) => {
        this.children.set(res.load.children ?? []);
      },
    });
  }

  private addressControl(field: AddressField, form: 'direct' | 'child' | 'add_drop' | 'x_dock') {
    if (form === 'direct') {
      if (field === 'collection') {
        return this.directForm.controls.collection_address_id;
      }
      if (field === 'delivery') {
        return this.directForm.controls.delivery_address_id;
      }
      return null;
    }
    if (form === 'child') {
      if (field === 'delivery') {
        return this.childEditForm.controls.delivery_address_id;
      }
      if (field === 'xdock') {
        return this.childEditForm.controls.xdock_address_id;
      }
      return null;
    }
    if (form === 'add_drop' && field === 'add_drop_delivery') {
      return this.addDropForm.controls.delivery_address_id;
    }
    if (form === 'x_dock') {
      if (field === 'x_dock_delivery') {
        return this.xDockForm.controls.delivery_address_id;
      }
      if (field === 'x_dock_xdock') {
        return this.xDockForm.controls.xdock_address_id;
      }
    }
    return null;
  }

  private setupSearchStreams(): void {
    this.partySearch$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ field, query }) => {
        const trimmed = query.trim();

        const generation = ++this.partySearchGeneration;
        this.updatePartyPicker(field, { loading: true });

        const partyType = field === 'customer' ? 'customer' : 'provider';
        let params = new HttpParams().set('party_type', partyType);
        const browseOnly = trimmed.length < SEARCH_MIN_CHARS;
        if (!browseOnly) {
          params = params.set('q', trimmed);
        }

        this.http
          .get<{ companies: PartyOption[] }>('/api/loads/party-options', { params })
          .pipe(catchError(() => of({ companies: [] })))
          .subscribe((res) => {
            if (generation !== this.partySearchGeneration) {
              return;
            }
            const companies = browseOnly
              ? res.companies.slice(0, PARTY_BROWSE_LIMIT)
              : res.companies;
            this.updatePartyPicker(field, { options: companies, loading: false });
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

        const addressType = field === 'collection' ? 'collection' : 'delivery';
        const pickerField = field;
        let params = new HttpParams().set('address_type', addressType);
        if (trimmed.length >= SEARCH_MIN_CHARS) {
          params = params.set('q', trimmed);
        }

        this.http
          .get<{ addresses: AddressOption[] }>('/api/loads/address-options', { params })
          .pipe(catchError(() => of({ addresses: [] })))
          .subscribe((res) => {
            if (generation !== this.addressSearchGeneration) {
              return;
            }
            this.updateAddressPicker(pickerField, { options: res.addresses, loading: false });
          });
      });
  }

  private syncDirectValidators(ownerType: OwnerCompanyType | null): void {
    const customer = this.directForm.controls.customer_company_id;
    const provider = this.directForm.controls.provider_company_id;

    if (ownerType === 'broker') {
      customer.setValidators([Validators.required]);
      provider.setValidators([Validators.required]);
    } else if (ownerType === 'customer') {
      customer.clearValidators();
      provider.setValidators([Validators.required]);
    } else if (ownerType === 'provider') {
      customer.setValidators([Validators.required]);
      provider.clearValidators();
    }

    customer.updateValueAndValidity();
    provider.updateValueAndValidity();

    if (this.loadType() === 'x_dock') {
      this.childEditForm.controls.xdock_address_id.setValidators([Validators.required]);
      this.childEditForm.controls.secondary_provider_company_id.setValidators([
        Validators.required,
      ]);
    }
    this.childEditForm.updateValueAndValidity();
  }

  private updatePartyPicker(field: PartyPickerKey, patch: Partial<PickerState>): void {
    this.partyPickers.update((state) => ({
      ...state,
      [field]: { ...state[field], ...patch },
    }));
  }

  private updateAddressPicker(field: AddressField, patch: Partial<PickerState>): void {
    this.addressPickers.update((state) => ({
      ...state,
      [field]: { ...state[field], ...patch },
    }));
  }

  private setPartyLabel(field: PartyPickerKey, label: string | null | undefined): void {
    if (!label) {
      return;
    }
    this.updatePartyPicker(field, { query: label, selectedLabel: label });
  }

  private setAddressLabel(field: AddressField, label: string | null | undefined): void {
    if (!label) {
      return;
    }
    this.updateAddressPicker(field, { query: label, selectedLabel: label });
  }

  private clearPartyValue(field: PartyPickerKey): void {
    if (field === 'customer') {
      this.directForm.controls.customer_company_id.setValue(null);
    } else if (field === 'provider') {
      this.directForm.controls.provider_company_id.setValue(null);
    } else if (field === 'x_dock_secondary') {
      this.xDockForm.controls.secondary_provider_company_id.setValue(null);
    } else {
      this.childEditForm.controls.secondary_provider_company_id.setValue(null);
    }
    this.updatePartyPicker(field, { selectedLabel: null });
  }

  private clearAddressValue(
    field: AddressField,
    form: 'direct' | 'child' | 'add_drop' | 'x_dock',
  ): void {
    this.addressControl(field, form)?.setValue(null);
    this.updateAddressPicker(field, { selectedLabel: null });
  }

  private truckTypeOptions(): VehicleBodyTypeOptionRow[] {
    return this.truckTypeCatalogue();
  }

  private syncTruckTypeFromLoad(row: LoadRow, catalogue: VehicleBodyTypeOptionRow[]): void {
    const id = row.vehicle_body_type_id;
    if (id === null) {
      return;
    }
    const inCatalogue = catalogue.some((item) => item.id === id);
    if (!inCatalogue && row.truck_type) {
      const parts = row.truck_type.split(' \\ ');
      const name = parts.length > 1 ? parts.slice(1).join(' \\ ') : row.truck_type;
      const category = parts.length > 1 ? parts[0] : null;
      this.truckTypeCatalogue.update((list) => [
        ...list,
        {
          id,
          name,
          code: '',
          vehicle_category_id: 0,
          category_name: category,
          capacity: 0,
          capacity_unit: 'pallet',
          options: row.vehicle_body_type_options ?? [],
        },
      ]);
    }
    if (row.truck_type) {
      this.truckTypePicker.set({
        query: row.truck_type,
        selectedLabel: row.truck_type,
        options: [],
        menuOpen: false,
        loading: false,
      });
    }
    if (row.vehicle_option_values) {
      this.vehicleOptionValues.set({ ...row.vehicle_option_values });
    }
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

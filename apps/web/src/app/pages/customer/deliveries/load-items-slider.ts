import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import {
  displayUnitLabel,
  formatWeightForDisplay,
  ItemDisplayUnit,
  ItemRow,
  weightInputToTonnes,
} from './item-format';
import { LoadRow, OwnerCompanyType } from './load.types';

const SEARCH_MIN_CHARS = 2;
const PARTY_BROWSE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface ItemsListResponse {
  items: ItemRow[];
}

interface PartyOption {
  id: number;
  business_name: string;
}

interface AddressOption {
  id: number;
  label: string;
  business_name: string;
}

type MoveAddressField = 'add_drop_delivery' | 'x_dock_delivery' | 'x_dock_xdock';

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

interface MoveResponse {
  item: ItemRow;
  child_load: LoadRow;
}

interface GoodTypeOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-load-items-slider',
  imports: [ReactiveFormsModule],
  templateUrl: './load-items-slider.html',
  styleUrl: './load-items-slider.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadItemsSlider {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly partySearch$ = new Subject<string>();
  private readonly addressSearch$ = new Subject<{ field: MoveAddressField; query: string }>();
  private partySearchGeneration = 0;
  private addressSearchGeneration = 0;

  readonly load = input.required<LoadRow>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly loading = signal(false);
  protected readonly assigning = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly assigned = signal<ItemRow[]>([]);
  protected readonly unassigned = signal<ItemRow[]>([]);
  protected readonly tab = signal<'assigned' | 'available'>('assigned');

  protected readonly children = signal<LoadRow[]>([]);
  protected readonly ownCompanyType = signal<OwnerCompanyType | null>(null);
  protected readonly movingItem = signal<ItemRow | null>(null);
  protected readonly moveMode = signal<'existing' | 'new'>('existing');
  protected readonly newChildType = signal<'add_drop' | 'x_dock'>('add_drop');

  protected readonly partyPicker = signal<PickerState>(emptyPicker());
  protected readonly addressPickers = signal<Record<MoveAddressField, PickerState>>({
    add_drop_delivery: emptyPicker(),
    x_dock_delivery: emptyPicker(),
    x_dock_xdock: emptyPicker(),
  });

  protected readonly canMoveToChild = computed(() => this.load().type === 'direct');
  protected readonly showXDockNewChild = computed(() => this.ownCompanyType() !== 'provider');

  protected readonly moveExistingForm = this.fb.nonNullable.group({
    child_load_id: this.fb.control<number | null>(null, [Validators.required]),
  });

  protected readonly moveAddDropForm = this.fb.nonNullable.group({
    delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
    pallet_count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
  });

  protected readonly moveXDockForm = this.fb.nonNullable.group({
    xdock_address_id: this.fb.control<number | null>(null, [Validators.required]),
    delivery_address_id: this.fb.control<number | null>(null, [Validators.required]),
    secondary_provider_company_id: this.fb.control<number | null>(null, [Validators.required]),
    pallet_count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
  });

  protected readonly createItemOpen = signal(false);
  protected readonly savingItem = signal(false);
  protected readonly createItemError = signal<string | null>(null);
  protected readonly goodTypeOptions = signal<GoodTypeOption[]>([]);

  protected readonly createItemForm = this.fb.nonNullable.group({
    good_type_code: this.fb.nonNullable.control('', [Validators.required]),
    weight: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.000_001)]),
    display_unit: this.fb.nonNullable.control<ItemDisplayUnit>('tonnes', [Validators.required]),
    order_number: this.fb.nonNullable.control(''),
    connote: this.fb.nonNullable.control(''),
    assign_to_load: this.fb.nonNullable.control(true),
  });

  constructor() {
    effect(() => {
      const current = this.load();
      this.children.set(current.children ?? []);
      if (current.id > 0) {
        this.reloadLists();
      }
    });

    this.setupSearchStreams();
    this.http
      .get<{ meta: { own_company_type?: OwnerCompanyType } }>('/api/loads', {
        params: { page: '1', per_page: '1' },
      })
      .subscribe({
        next: (res) => {
          this.ownCompanyType.set(res.meta.own_company_type ?? null);
        },
      });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected selectTab(tab: 'assigned' | 'available'): void {
    this.tab.set(tab);
    this.cancelMove();
  }

  protected itemSummary(item: ItemRow): string {
    const weight = `${formatWeightForDisplay(item.weight_tonnes, item.display_unit)} ${displayUnitLabel(item.display_unit)}`;
    const refs = [item.order_number, item.connote].filter(Boolean).join(' · ');
    return refs ? `${weight} · ${refs}` : weight;
  }

  protected childLabel(child: LoadRow): string {
    const party =
      child.type === 'x_dock' ? (child.secondary_provider ?? child.provider) : child.provider;
    return `${child.type_label} · ${child.delivery ?? '—'} · ${party}`;
  }

  protected openMove(item: ItemRow): void {
    this.movingItem.set(item);
    this.moveMode.set(this.children().length > 0 ? 'existing' : 'new');
    this.error.set(null);
    this.resetMoveForms();
  }

  protected cancelMove(): void {
    this.movingItem.set(null);
    this.error.set(null);
    this.resetMoveForms();
  }

  protected setMoveMode(mode: 'existing' | 'new'): void {
    this.moveMode.set(mode);
    this.error.set(null);
  }

  protected setNewChildType(type: 'add_drop' | 'x_dock'): void {
    this.newChildType.set(type);
    this.error.set(null);
  }

  protected partyState(): PickerState {
    return this.partyPicker();
  }

  protected addressState(field: MoveAddressField): PickerState {
    return this.addressPickers()[field];
  }

  protected onPartyQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.partyPicker.update((s) => ({ ...s, query: value, menuOpen: true }));
    if (this.partyPicker().selectedLabel !== null && value !== this.partyPicker().selectedLabel) {
      this.moveXDockForm.controls.secondary_provider_company_id.setValue(null);
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

  protected selectParty(option: PartyOption): void {
    this.moveXDockForm.controls.secondary_provider_company_id.setValue(option.id);
    this.partyPicker.set({
      query: option.business_name,
      selectedLabel: option.business_name,
      options: [],
      menuOpen: false,
      loading: false,
    });
  }

  protected onAddressQueryInput(
    field: MoveAddressField,
    event: Event,
    form: 'add_drop' | 'x_dock',
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateAddressPicker(field, { query: value, menuOpen: true });
    const picker = this.addressPickers()[field];
    if (picker.selectedLabel !== null && value !== picker.selectedLabel) {
      this.clearAddressValue(field, form);
    }
    this.addressSearch$.next({ field, query: value });
  }

  protected onAddressFocus(field: MoveAddressField): void {
    this.updateAddressPicker(field, { menuOpen: true });
    this.addressSearch$.next({ field, query: this.addressPickers()[field].query });
  }

  protected onAddressBlur(field: MoveAddressField): void {
    setTimeout(() => this.updateAddressPicker(field, { menuOpen: false }), 150);
  }

  protected selectAddress(
    field: MoveAddressField,
    option: AddressOption,
    form: 'add_drop' | 'x_dock',
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

  protected submitMove(): void {
    const item = this.movingItem();
    if (!item || this.assigning()) {
      return;
    }

    const parentId = this.load().id;
    let payload: Record<string, number | string>;

    if (this.moveMode() === 'existing') {
      this.moveExistingForm.markAllAsTouched();
      if (this.moveExistingForm.invalid) {
        return;
      }
      payload = { child_load_id: this.moveExistingForm.controls.child_load_id.value! };
    } else if (this.newChildType() === 'add_drop') {
      this.moveAddDropForm.markAllAsTouched();
      if (this.moveAddDropForm.invalid) {
        return;
      }
      const raw = this.moveAddDropForm.getRawValue();
      payload = {
        type: 'add_drop',
        delivery_address_id: raw.delivery_address_id!,
        pallet_count: raw.pallet_count,
      };
    } else {
      this.moveXDockForm.markAllAsTouched();
      if (this.moveXDockForm.invalid) {
        return;
      }
      const raw = this.moveXDockForm.getRawValue();
      payload = {
        type: 'x_dock',
        xdock_address_id: raw.xdock_address_id!,
        delivery_address_id: raw.delivery_address_id!,
        secondary_provider_company_id: raw.secondary_provider_company_id!,
        pallet_count: raw.pallet_count,
      };
    }

    this.assigning.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<MoveResponse>(`/api/loads/${parentId}/items/${item.id}/move`, payload),
        ),
      )
      .subscribe({
        next: (res) => {
          this.assigning.set(false);
          this.toastr.success('Item moved to child load.');
          this.children.update((list) => {
            if (list.some((c) => c.id === res.child_load.id)) {
              return list;
            }
            return [...list, res.child_load];
          });
          this.cancelMove();
          this.reloadLists();
          this.changed.emit();
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.assigning.set(false);
          const message = this.firstError(err) ?? 'Unable to move item.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected assignItem(item: ItemRow): void {
    if (this.assigning()) {
      return;
    }

    const loadId = this.load().id;
    this.assigning.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.post<{ item: ItemRow }>(`/api/loads/${loadId}/items`, { item_id: item.id }),
        ),
      )
      .subscribe({
        next: () => {
          this.assigning.set(false);
          this.toastr.success('Item assigned to load.');
          this.reloadLists();
          this.changed.emit();
        },
        error: () => {
          this.assigning.set(false);
          const message = 'Unable to assign item.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected openCreateItem(): void {
    this.createItemError.set(null);
    this.createItemForm.reset({
      good_type_code: '',
      weight: null,
      display_unit: 'tonnes',
      order_number: '',
      connote: '',
      assign_to_load: true,
    });
    this.createItemOpen.set(true);

    this.http
      .get<{ good_types: GoodTypeOption[] }>('/api/items/good-type-options')
      .pipe(catchError(() => of({ good_types: [] as GoodTypeOption[] })))
      .subscribe({
        next: (res) => {
          this.goodTypeOptions.set(res.good_types);
        },
      });
  }

  protected cancelCreateItem(): void {
    if (this.savingItem()) {
      return;
    }
    this.createItemOpen.set(false);
    this.createItemError.set(null);
  }

  protected submitCreateItem(): void {
    if (this.savingItem()) {
      return;
    }

    this.createItemForm.markAllAsTouched();
    if (this.createItemForm.invalid) {
      return;
    }

    const raw = this.createItemForm.getRawValue();
    const weight = raw.weight;
    if (weight === null) {
      return;
    }

    const payload: Record<string, unknown> = {
      good_type_code: raw.good_type_code,
      weight_tonnes: weightInputToTonnes(weight, raw.display_unit),
      display_unit: raw.display_unit,
      order_number: raw.order_number.trim() === '' ? null : raw.order_number.trim(),
      connote: raw.connote.trim() === '' ? null : raw.connote.trim(),
    };
    if (raw.assign_to_load) {
      payload['load_id'] = this.load().id;
    }

    this.savingItem.set(true);
    this.createItemError.set(null);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.post<{ item: ItemRow }>('/api/items', payload)))
      .subscribe({
        next: () => {
          this.savingItem.set(false);
          this.createItemOpen.set(false);
          this.toastr.success('Item created.');
          const assigned = raw.assign_to_load;
          this.reloadLists();
          if (assigned) {
            this.tab.set('assigned');
            this.changed.emit();
          }
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.savingItem.set(false);
          const message = this.firstError(err) ?? 'Could not create item.';
          this.createItemError.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected unassignItem(item: ItemRow): void {
    if (this.assigning()) {
      return;
    }

    const loadId = this.load().id;
    this.assigning.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => this.http.delete(`/api/loads/${loadId}/items/${item.id}`)))
      .subscribe({
        next: () => {
          this.assigning.set(false);
          this.toastr.success('Item removed from load.');
          this.reloadLists();
          this.changed.emit();
        },
        error: () => {
          this.assigning.set(false);
          const message = 'Unable to remove item.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  private reloadLists(): void {
    const loadId = this.load().id;
    this.loading.set(true);
    this.error.set(null);

    this.http.get<ItemsListResponse>(`/api/items?load_id=${loadId}&per_page=200&page=1`).subscribe({
      next: (assignedRes) => {
        this.assigned.set(assignedRes.items);
        this.http.get<ItemsListResponse>('/api/items?unassigned=1&per_page=200&page=1').subscribe({
          next: (unassignedRes) => {
            this.unassigned.set(unassignedRes.items);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.error.set('Unable to load unassigned items.');
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Unable to load items on this load.');
      },
    });
  }

  private resetMoveForms(): void {
    this.moveExistingForm.reset({ child_load_id: null });
    this.moveAddDropForm.reset({ delivery_address_id: null, pallet_count: 1 });
    this.moveXDockForm.reset({
      xdock_address_id: null,
      delivery_address_id: null,
      secondary_provider_company_id: null,
      pallet_count: 1,
    });
    this.partyPicker.set(emptyPicker());
    this.addressPickers.set({
      add_drop_delivery: emptyPicker(),
      x_dock_delivery: emptyPicker(),
      x_dock_xdock: emptyPicker(),
    });
    this.newChildType.set('add_drop');
  }

  private addressControl(field: MoveAddressField, form: 'add_drop' | 'x_dock') {
    if (form === 'add_drop' && field === 'add_drop_delivery') {
      return this.moveAddDropForm.controls.delivery_address_id;
    }
    if (form === 'x_dock') {
      if (field === 'x_dock_delivery') {
        return this.moveXDockForm.controls.delivery_address_id;
      }
      if (field === 'x_dock_xdock') {
        return this.moveXDockForm.controls.xdock_address_id;
      }
    }
    return null;
  }

  private clearAddressValue(field: MoveAddressField, form: 'add_drop' | 'x_dock'): void {
    this.addressControl(field, form)?.setValue(null);
    this.updateAddressPicker(field, { selectedLabel: null });
  }

  private updateAddressPicker(field: MoveAddressField, patch: Partial<PickerState>): void {
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

        this.http
          .get<{ addresses: AddressOption[] }>('/api/loads/address-options', { params })
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

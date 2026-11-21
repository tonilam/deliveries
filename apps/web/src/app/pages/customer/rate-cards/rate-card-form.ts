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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { RateCardUserType } from './rate-cards';

interface ZoneOption {
  id: number;
  name: string;
  code: string;
}

interface CompanyOption {
  id: number;
  business_name: string;
}

type ZonePickerField = 'collection' | 'delivery';

interface ZonePickerTarget {
  row: number;
  field: ZonePickerField;
}

interface ZoneRateRow {
  collection_zone_id: number | null;
  collection_zone_query: string;
  delivery_zone_id: number | null;
  delivery_zone_query: string;
  base_rate: string;
  fuel_surcharge_percent: string;
}

interface RateCardDetail {
  id: number;
  profile_name: string;
  user_type: RateCardUserType;
  minimum_price: string;
  is_active: boolean;
  customer_companies: CompanyOption[];
  provider_companies: CompanyOption[];
  zone_rates: {
    collection_zone_id: number;
    collection_zone: string;
    delivery_zone_id: number;
    delivery_zone: string;
    base_rate: string;
    fuel_surcharge_percent: string;
  }[];
}

const COMPANY_SEARCH_MIN_CHARS = 2;
const ZONE_SEARCH_MIN_CHARS = 2;
const ZONE_SUGGESTION_LIMIT = 200;

@Component({
  selector: 'app-customer-rate-card-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './rate-card-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './rate-card-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerRateCardForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly zoneOptions = signal<ZoneOption[]>([]);
  protected readonly zoneCatalogReady = signal(false);
  protected readonly rateCardId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.rateCardId() !== null);
  protected readonly title = computed(() =>
    this.isEdit() ? 'Edit rate card' : 'Create rate card',
  );

  protected readonly selectedCompanies = signal<CompanyOption[]>([]);
  protected readonly companyQuery = signal('');
  protected readonly companySuggestions = signal<CompanyOption[]>([]);
  protected readonly companyMenuOpen = signal(false);
  protected readonly companiesLoading = signal(false);
  protected readonly activeCompanySuggestionIndex = signal(-1);

  protected readonly zoneRows = signal<ZoneRateRow[]>([this.emptyZoneRow()]);
  protected readonly zoneRowError = signal<string | null>(null);
  protected readonly openZonePicker = signal<ZonePickerTarget | null>(null);
  protected readonly zonePickerSuggestions = signal<ZoneOption[]>([]);
  protected readonly activeZoneSuggestionIndex = signal(-1);

  protected readonly restrictionLabel = computed(() =>
    this.form.controls.user_type.value === 'provider' ? 'Providers' : 'Customers',
  );

  protected readonly form = this.fb.nonNullable.group({
    profile_name: ['', [Validators.required, Validators.maxLength(255)]],
    user_type: this.fb.nonNullable.control<RateCardUserType>('customer', [Validators.required]),
    minimum_price: this.fb.nonNullable.control('0', [
      Validators.required,
      Validators.pattern(/^\d+(\.\d{1,2})?$/),
    ]),
    is_active: this.fb.nonNullable.control(true),
  });

  private companySearchGeneration = 0;

  ngOnInit(): void {
    this.form.controls.user_type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedCompanies.set([]);
      });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id < 1) {
        this.error.set('Invalid rate card.');
        this.loadFailed.set(true);
        return;
      }
      this.rateCardId.set(id);
      this.loading.set(true);
    }

    const rateCardId = this.rateCardId();
    forkJoin({
      zones: this.http.get<{ zones: ZoneOption[] }>('/api/addresses/zone-options'),
      rateCard: rateCardId
        ? this.http.get<{ rate_card: RateCardDetail }>(`/api/rate-cards/${rateCardId}`)
        : of(null),
    }).subscribe({
      next: ({ zones, rateCard }) => {
        this.zoneOptions.set(zones.zones);
        this.zoneCatalogReady.set(zones.zones.length > 0);

        if (zones.zones.length === 0) {
          this.error.set('No zones are configured for your company country.');
        }

        if (rateCard) {
          const card = rateCard.rate_card;
          this.form.patchValue({
            profile_name: card.profile_name,
            user_type: card.user_type,
            minimum_price: String(card.minimum_price),
            is_active: card.is_active,
          });
          const companies =
            card.user_type === 'provider' ? card.provider_companies : card.customer_companies;
          this.selectedCompanies.set(companies);
          this.zoneRows.set(
            card.zone_rates.map((row) => ({
              collection_zone_id: row.collection_zone_id,
              collection_zone_query: row.collection_zone,
              delivery_zone_id: row.delivery_zone_id,
              delivery_zone_query: row.delivery_zone,
              base_rate: String(row.base_rate),
              fuel_surcharge_percent: String(row.fuel_surcharge_percent),
            })),
          );
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          rateCardId
            ? 'Unable to load rate card.'
            : 'Unable to load zones for your company country.',
        );
        this.loadFailed.set(rateCardId !== null);
        this.loading.set(false);
      },
    });
  }

  protected addZoneRow(): void {
    this.zoneRows.update((rows) => [...rows, this.emptyZoneRow()]);
  }

  protected removeZoneRow(index: number): void {
    this.zoneRows.update((rows) => {
      if (rows.length <= 1) {
        return rows;
      }
      return rows.filter((_, i) => i !== index);
    });
    const open = this.openZonePicker();
    if (open?.row === index) {
      this.closeZonePicker();
    }
  }

  protected onZoneFieldChange(
    index: number,
    field: 'base_rate' | 'fuel_surcharge_percent',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.zoneRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  protected isZonePickerOpen(row: number, field: ZonePickerField): boolean {
    const open = this.openZonePicker();
    return open?.row === row && open?.field === field;
  }

  protected zoneQueryFor(row: ZoneRateRow, field: ZonePickerField): string {
    return field === 'collection' ? row.collection_zone_query : row.delivery_zone_query;
  }

  protected zoneOptionId(row: number, field: ZonePickerField, zoneId: number): string {
    return `zone-option-${row}-${field}-${zoneId}`;
  }

  protected activeZoneOptionId(row: number, field: ZonePickerField): string | null {
    if (!this.isZonePickerOpen(row, field)) {
      return null;
    }
    const index = this.activeZoneSuggestionIndex();
    const zone = this.zonePickerSuggestions()[index];
    return zone ? this.zoneOptionId(row, field, zone.id) : null;
  }

  protected zoneSearchHint(row: number, field: ZonePickerField): string | null {
    if (!this.zoneCatalogReady()) {
      return null;
    }
    const zoneRow = this.zoneRows()[row];
    if (!zoneRow) {
      return null;
    }
    const query = this.zoneQueryFor(zoneRow, field).trim();
    if (query.length > 0 && query.length < ZONE_SEARCH_MIN_CHARS) {
      return `Type at least ${ZONE_SEARCH_MIN_CHARS} characters to search.`;
    }
    if (
      this.isZonePickerOpen(row, field) &&
      query.length >= ZONE_SEARCH_MIN_CHARS &&
      this.zonePickerSuggestions().length === 0
    ) {
      const selectedName =
        field === 'collection'
          ? this.selectedCollectionName(zoneRow)
          : this.selectedDeliveryName(zoneRow);
      if (selectedName !== query) {
        return 'No zones found.';
      }
    }
    return null;
  }

  protected onZoneQueryInput(row: number, field: ZonePickerField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.patchZoneQuery(row, field, value);
    this.openZonePicker.set({ row, field });
    this.activeZoneSuggestionIndex.set(-1);
    this.refreshZoneSuggestions(value);
    this.clearZoneIdIfQueryMismatch(row, field, value);
  }

  protected onZoneFocus(row: number, field: ZonePickerField): void {
    const zoneRow = this.zoneRows()[row];
    if (!zoneRow) {
      return;
    }
    const query = this.zoneQueryFor(zoneRow, field).trim();
    const selectedName =
      field === 'collection'
        ? this.selectedCollectionName(zoneRow)
        : this.selectedDeliveryName(zoneRow);
    if (selectedName !== null && selectedName === query) {
      return;
    }

    this.openZonePicker.set({ row, field });
    this.refreshZoneSuggestions(query);
    if (this.zonePickerSuggestions().length > 0 && this.activeZoneSuggestionIndex() < 0) {
      this.activeZoneSuggestionIndex.set(0);
    }
  }

  protected onZoneBlur(row: number, field: ZonePickerField): void {
    window.setTimeout(() => {
      const open = this.openZonePicker();
      if (open?.row === row && open.field === field) {
        this.closeZonePicker();
      }
    }, 150);
  }

  protected onZoneKeydown(row: number, field: ZonePickerField, event: KeyboardEvent): void {
    const suggestions = this.zonePickerSuggestions();
    const menuExpanded = this.isZonePickerOpen(row, field);
    const listVisible = menuExpanded && suggestions.length > 0;

    if (event.key === 'Escape') {
      if (menuExpanded) {
        event.preventDefault();
        this.closeZonePicker();
      }
      return;
    }

    if (event.key === 'Enter' && menuExpanded) {
      event.preventDefault();
      const index = this.activeZoneSuggestionIndex();
      if (listVisible && index >= 0 && index < suggestions.length) {
        this.selectZone(row, field, suggestions[index]);
      }
      return;
    }

    if (!listVisible && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (suggestions.length > 0) {
        event.preventDefault();
        this.openZonePicker.set({ row, field });
        this.moveActiveZoneSuggestion(event.key === 'ArrowDown' ? 1 : -1, row, field);
      }
      return;
    }

    if (!listVisible) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActiveZoneSuggestion(1, row, field);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveZoneSuggestion(-1, row, field);
    }
  }

  protected selectZone(row: number, field: ZonePickerField, zone: ZoneOption): void {
    this.zoneRows.update((rows) =>
      rows.map((item, i) => {
        if (i !== row) {
          return item;
        }
        if (field === 'collection') {
          return {
            ...item,
            collection_zone_id: zone.id,
            collection_zone_query: zone.name,
          };
        }
        return {
          ...item,
          delivery_zone_id: zone.id,
          delivery_zone_query: zone.name,
        };
      }),
    );
    this.closeZonePicker();
  }

  protected onCompanyQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.companyQuery.set(value);
    this.companyMenuOpen.set(true);
    this.activeCompanySuggestionIndex.set(-1);
    this.emitCompanySearch(value);
  }

  protected onCompanyFocus(): void {
    this.companyMenuOpen.set(true);
    this.emitCompanySearch(this.companyQuery().trim());
  }

  protected onCompanyBlur(): void {
    window.setTimeout(() => {
      this.companyMenuOpen.set(false);
      this.activeCompanySuggestionIndex.set(-1);
    }, 150);
  }

  protected selectCompany(company: CompanyOption): void {
    const existing = this.selectedCompanies().some((c) => c.id === company.id);
    if (!existing) {
      this.selectedCompanies.update((list) => [...list, company]);
    }
    this.companyQuery.set('');
    this.companySuggestions.set([]);
    this.companyMenuOpen.set(false);
    this.activeCompanySuggestionIndex.set(-1);
  }

  protected removeCompany(id: number): void {
    this.selectedCompanies.update((list) => list.filter((c) => c.id !== id));
  }

  protected submit(): void {
    this.zoneRowError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.zoneCatalogReady()) {
      this.error.set('No zones are configured for your company country.');
      return;
    }

    const zoneRates = this.buildZoneRatesPayload();
    if (zoneRates === null) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      profile_name: raw.profile_name,
      user_type: raw.user_type,
      minimum_price: Number.parseFloat(raw.minimum_price),
      is_active: raw.is_active,
      company_ids: this.selectedCompanies().map((c) => c.id),
      zone_rates: zoneRates,
    };

    const rateCardId = this.rateCardId();
    const request$ =
      rateCardId === null
        ? this.http.post('/api/rate-cards', payload)
        : this.http.put(`/api/rate-cards/${rateCardId}`, payload);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl('/app/rate-cards');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          this.error.set(this.firstError(err) ?? 'Could not save rate card');
        },
      });
  }

  private buildZoneRatesPayload():
    | {
        collection_zone_id: number;
        delivery_zone_id: number;
        base_rate: number;
        fuel_surcharge_percent: number;
      }[]
    | null {
    const rows = this.zoneRows();
    const payload: {
      collection_zone_id: number;
      delivery_zone_id: number;
      base_rate: number;
      fuel_surcharge_percent: number;
    }[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.collection_zone_id === null || row.delivery_zone_id === null) {
        this.zoneRowError.set(
          `Row ${i + 1}: select collection and delivery zones from the suggestions.`,
        );
        return null;
      }
      const base = Number.parseFloat(row.base_rate);
      const fuel = Number.parseFloat(row.fuel_surcharge_percent);
      if (Number.isNaN(base) || base < 0) {
        this.zoneRowError.set(`Row ${i + 1}: enter a valid base rate.`);
        return null;
      }
      if (Number.isNaN(fuel) || fuel < 0) {
        this.zoneRowError.set(`Row ${i + 1}: enter a valid fuel surcharge %.`);
        return null;
      }
      payload.push({
        collection_zone_id: row.collection_zone_id,
        delivery_zone_id: row.delivery_zone_id,
        base_rate: base,
        fuel_surcharge_percent: fuel,
      });
    }

    const pairs = new Set<string>();
    for (const row of payload) {
      const key = `${row.collection_zone_id}:${row.delivery_zone_id}`;
      if (pairs.has(key)) {
        this.zoneRowError.set('Each collection and delivery zone pair must be unique.');
        return null;
      }
      pairs.add(key);
    }

    return payload;
  }

  private patchZoneQuery(row: number, field: ZonePickerField, value: string): void {
    this.zoneRows.update((rows) =>
      rows.map((item, i) => {
        if (i !== row) {
          return item;
        }
        if (field === 'collection') {
          return { ...item, collection_zone_query: value };
        }
        return { ...item, delivery_zone_query: value };
      }),
    );
  }

  private clearZoneIdIfQueryMismatch(row: number, field: ZonePickerField, query: string): void {
    const zoneRow = this.zoneRows()[row];
    if (!zoneRow) {
      return;
    }
    const selectedName =
      field === 'collection'
        ? this.selectedCollectionName(zoneRow)
        : this.selectedDeliveryName(zoneRow);
    if (selectedName !== null && query !== selectedName) {
      this.zoneRows.update((rows) =>
        rows.map((item, i) => {
          if (i !== row) {
            return item;
          }
          if (field === 'collection') {
            return { ...item, collection_zone_id: null };
          }
          return { ...item, delivery_zone_id: null };
        }),
      );
    }
  }

  private selectedCollectionName(row: ZoneRateRow): string | null {
    if (row.collection_zone_id === null) {
      return null;
    }
    return (
      this.zoneOptions().find((z) => z.id === row.collection_zone_id)?.name ??
      (row.collection_zone_query || null)
    );
  }

  private selectedDeliveryName(row: ZoneRateRow): string | null {
    if (row.delivery_zone_id === null) {
      return null;
    }
    return (
      this.zoneOptions().find((z) => z.id === row.delivery_zone_id)?.name ??
      (row.delivery_zone_query || null)
    );
  }

  private refreshZoneSuggestions(query: string): void {
    const trimmed = query.trim();
    if (trimmed.length < ZONE_SEARCH_MIN_CHARS) {
      this.zonePickerSuggestions.set([]);
      return;
    }

    const needle = trimmed.toLowerCase();
    const matches = this.zoneOptions().filter(
      (zone) =>
        zone.name.toLowerCase().includes(needle) || zone.code.toLowerCase().includes(needle),
    );

    this.zonePickerSuggestions.set(matches.slice(0, ZONE_SUGGESTION_LIMIT));
    const open = this.openZonePicker();
    if (open && matches.length > 0 && this.activeZoneSuggestionIndex() < 0) {
      this.activeZoneSuggestionIndex.set(0);
    }
  }

  private moveActiveZoneSuggestion(delta: number, row: number, field: ZonePickerField): void {
    const count = this.zonePickerSuggestions().length;
    if (count === 0) {
      this.activeZoneSuggestionIndex.set(-1);
      return;
    }

    const current = this.activeZoneSuggestionIndex();
    const next = current < 0 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count;
    this.activeZoneSuggestionIndex.set(next);
    this.scrollActiveZoneSuggestionIntoView(next, row, field);
  }

  private scrollActiveZoneSuggestionIntoView(
    index: number,
    row: number,
    field: ZonePickerField,
  ): void {
    const zone = this.zonePickerSuggestions()[index];
    if (!zone) {
      return;
    }
    queueMicrotask(() => {
      document.getElementById(this.zoneOptionId(row, field, zone.id))?.scrollIntoView({
        block: 'nearest',
      });
    });
  }

  private closeZonePicker(): void {
    this.openZonePicker.set(null);
    this.zonePickerSuggestions.set([]);
    this.activeZoneSuggestionIndex.set(-1);
  }

  private emptyZoneRow(): ZoneRateRow {
    return {
      collection_zone_id: null,
      collection_zone_query: '',
      delivery_zone_id: null,
      delivery_zone_query: '',
      base_rate: '',
      fuel_surcharge_percent: '0',
    };
  }

  private emitCompanySearch(query: string): void {
    const generation = ++this.companySearchGeneration;

    if (query.length < COMPANY_SEARCH_MIN_CHARS) {
      this.companySuggestions.set([]);
      this.companiesLoading.set(false);
      return;
    }

    this.companiesLoading.set(true);
    const params = new HttpParams().set('q', query);

    this.http
      .get<{ companies: CompanyOption[] }>('/api/rate-cards/company-options', { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ companies }) => {
          if (generation !== this.companySearchGeneration) {
            return;
          }
          const selectedIds = new Set(this.selectedCompanies().map((c) => c.id));
          this.companySuggestions.set(companies.filter((c) => !selectedIds.has(c.id)));
          this.companiesLoading.set(false);
        },
        error: () => {
          if (generation === this.companySearchGeneration) {
            this.companySuggestions.set([]);
            this.companiesLoading.set(false);
          }
        },
      });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    if (errors) {
      for (const messages of Object.values(errors)) {
        if (messages?.[0]) {
          return messages[0];
        }
      }
    }

    return err.error?.message;
  }
}

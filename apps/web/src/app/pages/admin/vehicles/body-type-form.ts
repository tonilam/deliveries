import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';
import {
  VEHICLE_CAPACITY_UNITS,
  VehicleBodyType,
  VehicleBodyTypeOption,
  VehicleOptionDataType,
  VehicleOptionVisibility,
} from '../../../core/vehicle/vehicle.model';

@Component({
  selector: 'app-admin-vehicle-body-type-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './body-type-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './body-type-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminVehicleBodyTypeForm implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly capacityUnits = VEHICLE_CAPACITY_UNITS;
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly loading = signal(false);
  protected readonly categoryId = signal<number | null>(null);
  protected readonly bodyTypeId = signal<number | null>(null);
  protected readonly options = signal<VehicleBodyTypeOption[]>([]);
  protected readonly optionFormOpen = signal(false);
  protected readonly editingOptionId = signal<number | null>(null);
  protected readonly isEdit = computed(() => this.bodyTypeId() !== null);
  protected readonly title = computed(() => (this.isEdit() ? 'Edit body type' : 'Add body type'));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(64)]],
    capacity: [0, [Validators.required, Validators.min(0)]],
    capacity_unit: ['pallet', [Validators.required]],
    pallet_spaces: this.fb.control<number | null>(null),
    cubic_metres: this.fb.control<number | null>(null),
    payload_kg: this.fb.control<number | null>(null),
    description: [''],
  });

  protected readonly optionForm = this.fb.nonNullable.group({
    key: ['', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]],
    label: ['', [Validators.required]],
    data_type: ['boolean' as VehicleOptionDataType, [Validators.required]],
    visibility: ['public' as VehicleOptionVisibility, [Validators.required]],
    required: [false],
    sort_order: [0, [Validators.min(0)]],
  });

  protected readonly optionValueControls = signal<Record<string, FormControl<string | boolean>>>(
    {},
  );

  ngOnInit(): void {
    const categoryId = Number(this.route.snapshot.paramMap.get('categoryId'));
    const bodyTypeIdParam = this.route.snapshot.paramMap.get('id');
    if (!Number.isFinite(categoryId)) {
      this.error.set('Invalid category.');
      return;
    }
    this.categoryId.set(categoryId);

    if (!bodyTypeIdParam) {
      return;
    }

    const bodyTypeId = Number(bodyTypeIdParam);
    if (!Number.isFinite(bodyTypeId)) {
      this.error.set('Invalid body type.');
      return;
    }

    this.bodyTypeId.set(bodyTypeId);
    this.loading.set(true);

    this.http
      .get<{ vehicle_body_type: VehicleBodyType }>(
        `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}`,
      )
      .subscribe({
        next: (res) => {
          const row = res.vehicle_body_type;
          this.form.patchValue({
            name: row.name,
            code: row.code,
            capacity: row.capacity,
            capacity_unit: row.capacity_unit,
            pallet_spaces: row.pallet_spaces,
            cubic_metres: row.cubic_metres,
            payload_kg: row.payload_kg,
            description: row.description ?? '',
          });
          this.options.set(row.options ?? []);
          this.syncOptionValueControls(row.options ?? [], row.option_values ?? {});
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load body type.');
          this.loading.set(false);
        },
      });
  }

  protected openNewOption(): void {
    this.editingOptionId.set(null);
    this.optionForm.reset({
      key: '',
      label: '',
      data_type: 'boolean',
      visibility: 'public',
      required: false,
      sort_order: this.options().length,
    });
    this.optionFormOpen.set(true);
  }

  protected openEditOption(option: VehicleBodyTypeOption): void {
    this.editingOptionId.set(option.id);
    this.optionForm.patchValue({
      key: option.key,
      label: option.label,
      data_type: option.data_type,
      visibility: option.visibility,
      required: option.required,
      sort_order: option.sort_order,
    });
    this.optionFormOpen.set(true);
  }

  protected cancelOptionForm(): void {
    this.optionFormOpen.set(false);
    this.editingOptionId.set(null);
  }

  protected saveOptionDefinition(): void {
    const categoryId = this.categoryId();
    const bodyTypeId = this.bodyTypeId();
    if (!categoryId || !bodyTypeId || this.optionForm.invalid) {
      this.optionForm.markAllAsTouched();
      return;
    }

    const payload = this.optionForm.getRawValue();
    const editingId = this.editingOptionId();
    const url = editingId
      ? `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}/options/${editingId}`
      : `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}/options`;

    const request$ = editingId ? this.http.put(url, payload) : this.http.post(url, payload);

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: () => {
          this.optionFormOpen.set(false);
          this.reloadBodyType();
          this.toastr.success(
            editingId ? 'Option definition updated.' : 'Option definition created.',
          );
        },
        error: (err: { error?: { errors?: Record<string, string[]> } }) => {
          const message = err.error?.errors?.['key']?.[0] ?? 'Unable to save option definition.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected deleteOption(option: VehicleBodyTypeOption): void {
    const categoryId = this.categoryId();
    const bodyTypeId = this.bodyTypeId();
    if (!categoryId || !bodyTypeId) {
      return;
    }

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() =>
          this.http.delete(
            `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}/options/${option.id}`,
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.reloadBodyType();
          this.toastr.success('Option definition deleted.');
        },
        error: () => {
          const message = 'Unable to delete option.';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const categoryId = this.categoryId();
    if (!categoryId) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const optionValues = this.collectOptionValues();
    const payload = {
      ...this.form.getRawValue(),
      option_values: optionValues,
    };

    const bodyTypeId = this.bodyTypeId();
    const request$ = bodyTypeId
      ? this.http.put<{ vehicle_body_type: VehicleBodyType }>(
          `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}`,
          payload,
        )
      : this.http.post<{ vehicle_body_type: VehicleBodyType }>(
          `/api/admin/vehicle-categories/${categoryId}/body-types`,
          payload,
        );

    this.auth
      .ensureCsrf()
      .pipe(switchMap(() => request$))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (!bodyTypeId && res.vehicle_body_type.id) {
            this.bodyTypeId.set(res.vehicle_body_type.id);
            this.options.set(res.vehicle_body_type.options ?? []);
            this.syncOptionValueControls(
              res.vehicle_body_type.options ?? [],
              res.vehicle_body_type.option_values ?? {},
            );
          }
          this.toastr.success(bodyTypeId ? 'Body type updated.' : 'Body type created.');
        },
        error: (err: { error?: { errors?: Record<string, string[]> } }) => {
          const first =
            err.error?.errors?.['option_values.mezzanine']?.[0] ?? err.error?.errors?.['code']?.[0];
          const message = first ?? 'Unable to save body type.';
          this.error.set(message);
          this.toastr.error(message);
          this.submitting.set(false);
        },
      });
  }

  private reloadBodyType(): void {
    const categoryId = this.categoryId();
    const bodyTypeId = this.bodyTypeId();
    if (!categoryId || !bodyTypeId) {
      return;
    }

    this.http
      .get<{ vehicle_body_type: VehicleBodyType }>(
        `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}`,
      )
      .subscribe({
        next: (res) => {
          this.options.set(res.vehicle_body_type.options ?? []);
          this.syncOptionValueControls(
            res.vehicle_body_type.options ?? [],
            res.vehicle_body_type.option_values ?? {},
          );
        },
      });
  }

  private syncOptionValueControls(
    definitions: VehicleBodyTypeOption[],
    values: Record<string, string | boolean>,
  ): void {
    const controls: Record<string, FormControl<string | boolean>> = {};
    for (const def of definitions) {
      const initial = values[def.key] ?? (def.data_type === 'boolean' ? false : '');
      controls[def.key] = this.fb.nonNullable.control(initial as string | boolean);
    }
    this.optionValueControls.set(controls);
  }

  private collectOptionValues(): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    const controls = this.optionValueControls();
    for (const [key, control] of Object.entries(controls)) {
      out[key] = control.value as string | boolean;
    }
    return out;
  }
}

import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

export interface LoadSchedule {
  pickup_date: string;
  pickup_time: string;
  dropoff_date: string;
  dropoff_time: string;
}

export function defaultLoadSchedule(): LoadSchedule {
  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 1);
  pickup.setHours(8, 0, 0, 0);
  const dropoff = new Date(pickup);
  dropoff.setDate(dropoff.getDate() + 1);
  dropoff.setHours(17, 0, 0, 0);

  return {
    pickup_date: formatDateInput(pickup),
    pickup_time: formatTimeInput(pickup),
    dropoff_date: formatDateInput(dropoff),
    dropoff_time: formatTimeInput(dropoff),
  };
}

export function loadScheduleControls(
  fb: FormBuilder,
  defaults: LoadSchedule = defaultLoadSchedule(),
) {
  return {
    pickup_date: fb.nonNullable.control(defaults.pickup_date, Validators.required),
    pickup_time: fb.nonNullable.control(defaults.pickup_time, Validators.required),
    dropoff_date: fb.nonNullable.control(defaults.dropoff_date, Validators.required),
    dropoff_time: fb.nonNullable.control(defaults.dropoff_time, Validators.required),
  };
}

export function loadScheduleOrderValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    if (!group.get) {
      return null;
    }

    const pickup_date = group.get('pickup_date')?.value;
    const pickup_time = group.get('pickup_time')?.value;
    const dropoff_date = group.get('dropoff_date')?.value;
    const dropoff_time = group.get('dropoff_time')?.value;

    if (
      typeof pickup_date !== 'string' ||
      typeof pickup_time !== 'string' ||
      typeof dropoff_date !== 'string' ||
      typeof dropoff_time !== 'string' ||
      pickup_date === '' ||
      pickup_time === '' ||
      dropoff_date === '' ||
      dropoff_time === ''
    ) {
      return null;
    }

    const pickup = Date.parse(`${pickup_date}T${pickup_time}`);
    const dropoff = Date.parse(`${dropoff_date}T${dropoff_time}`);

    if (Number.isNaN(pickup) || Number.isNaN(dropoff) || dropoff >= pickup) {
      return null;
    }

    return { scheduleOrder: true };
  };
}

export function formatScheduleColumn(date: string, time: string): string {
  return `${date} ${time}`;
}

function formatDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeInput(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

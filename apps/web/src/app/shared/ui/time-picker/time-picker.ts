import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function parseTime(value: string): { hour: number; minute: number } | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
    return null;
  }
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return { hour: h, minute: m };
}

function clampHour(raw: number): number {
  return Math.min(23, Math.max(0, Math.trunc(raw)));
}

function clampMinute(raw: number): number {
  return Math.min(59, Math.max(0, Math.trunc(raw)));
}

/**
 * Time picker styled like truckit ui-date-picker (panel + trigger). Value: HH:mm (24h).
 */
@Component({
  selector: 'ui-time-picker',
  template: `
    @if (label()) {
      <label class="dp-label" [attr.for]="triggerId">{{ label() }}</label>
    }
    <div class="dp">
      <button
        [id]="triggerId"
        type="button"
        class="dp-trigger"
        [class.dp-trigger--open]="open()"
        [disabled]="isDisabled()"
        (click)="toggle()"
      >
        <span class="dp-value" [class.dp-value--placeholder]="!value()">
          {{ value() || placeholder() }}
        </span>
        <span class="dp-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 16 14" />
          </svg>
        </span>
      </button>

      @if (open()) {
        <div
          class="dp-panel tp-panel"
          role="dialog"
          aria-label="Choose time"
          (mousedown)="$event.stopPropagation()"
        >
          <div class="tp-fields">
            <label class="tp-field">
              <span class="tp-field__label">Hours</span>
              <input
                class="tp-input"
                type="number"
                inputmode="numeric"
                min="0"
                max="23"
                step="1"
                [disabled]="isDisabled()"
                [value]="draftHour() ?? ''"
                (input)="onHourInput($event)"
                (keydown.enter)="applyTime($event)"
              />
            </label>
            <span class="tp-sep" aria-hidden="true">:</span>
            <label class="tp-field">
              <span class="tp-field__label">Minutes</span>
              <input
                class="tp-input"
                type="number"
                inputmode="numeric"
                min="0"
                max="59"
                step="1"
                [disabled]="isDisabled()"
                [value]="draftMinute() ?? ''"
                (input)="onMinuteInput($event)"
                (keydown.enter)="applyTime($event)"
              />
            </label>
          </div>
          <button type="button" class="tp-apply" [disabled]="!canApply()" (click)="applyTime()">
            Apply
          </button>
        </div>
      }
    </div>
  `,
  styleUrls: ['../truckit-tokens.scss', './time-picker.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiTimePickerComponent),
      multi: true,
    },
  ],
})
export class UiTimePickerComponent implements ControlValueAccessor {
  private static nextId = 0;

  private readonly el = inject(ElementRef<HTMLElement>);
  protected readonly triggerId = `ui-time-picker-trigger-${UiTimePickerComponent.nextId++}`;

  readonly label = input('');
  readonly placeholder = input('Select time');
  readonly disabled = input(false);

  private readonly controlDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.controlDisabled());

  readonly valueChange = output<string>();

  protected readonly value = signal('');
  protected readonly open = signal(false);
  protected readonly draftHour = signal<number | null>(null);
  protected readonly draftMinute = signal<number | null>(null);

  protected readonly canApply = computed(() => {
    return this.draftHour() !== null && this.draftMinute() !== null;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    if (!this.el.nativeElement.contains(event.target as Node)) {
      if (this.canApply()) {
        this.applyTime();
      } else {
        this.open.set(false);
      }
    }
  }

  protected toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    const next = !this.open();
    if (next) {
      this.syncDraftFromValue();
    }
    this.open.set(next);
  }

  protected onHourInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') {
      this.draftHour.set(null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      return;
    }
    this.draftHour.set(clampHour(parsed));
  }

  protected onMinuteInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') {
      this.draftMinute.set(null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      return;
    }
    this.draftMinute.set(clampMinute(parsed));
  }

  protected applyTime(event?: Event): void {
    event?.preventDefault();
    const hour = this.draftHour();
    const minute = this.draftMinute();
    if (hour === null || minute === null) {
      return;
    }

    const next = `${padTwo(clampHour(hour))}:${padTwo(clampMinute(minute))}`;
    this.value.set(next);
    this.onChange(next);
    this.valueChange.emit(next);
    this.onTouched();
    this.open.set(false);
  }

  private syncDraftFromValue(): void {
    const parsed = parseTime(this.value());
    if (parsed) {
      this.draftHour.set(parsed.hour);
      this.draftMinute.set(parsed.minute);
      return;
    }
    this.draftHour.set(8);
    this.draftMinute.set(0);
  }

  writeValue(value: string | null): void {
    this.value.set(typeof value === 'string' ? value : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled.set(isDisabled);
  }
}

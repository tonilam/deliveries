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

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateValue(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(`${String(value)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

/**
 * Mirrors truckit-component-library UiDatePickerComponent (Form value: YYYY-MM-DD).
 * Replace with truckit-component-library when installed from CodeArtifact.
 */
@Component({
  selector: 'ui-date-picker',
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
        <span class="dp-value" [class.dp-value--placeholder]="!selected()">
          {{ selected() ? formatted() : placeholder() }}
        </span>
        <span class="dp-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      </button>

      @if (open()) {
        <div class="dp-panel" role="dialog" aria-label="Choose date">
          <div class="dp-header">
            <button type="button" class="dp-nav" aria-label="Previous month" (click)="prevMonth()">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span class="dp-month">{{ monthLabel() }}</span>
            <button type="button" class="dp-nav" aria-label="Next month" (click)="nextMonth()">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div class="dp-weekdays">
            @for (wd of weekdays; track wd) {
              <span class="dp-weekday">{{ wd }}</span>
            }
          </div>
          <div class="dp-grid">
            @for (cell of days(); track cell.date.getTime()) {
              <button
                type="button"
                class="dp-day"
                [class.dp-day--outside]="!cell.inMonth"
                [class.dp-day--today]="cell.isToday"
                [class.dp-day--selected]="cell.isSelected"
                (click)="selectDate(cell.date)"
              >
                {{ cell.date.getDate() }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['../truckit-tokens.scss', './date-picker.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiDatePickerComponent),
      multi: true,
    },
  ],
})
export class UiDatePickerComponent implements ControlValueAccessor {
  private static nextId = 0;

  private readonly el = inject(ElementRef<HTMLElement>);
  protected readonly triggerId = `ui-date-picker-trigger-${UiDatePickerComponent.nextId++}`;

  readonly label = input('');
  readonly placeholder = input('Select date');
  readonly disabled = input(false);

  private readonly controlDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.controlDisabled());

  readonly valueChange = output<string>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly selected = signal<Date | null>(null);
  protected readonly viewDate = signal(new Date());
  protected readonly open = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly monthLabel = computed(() => {
    const date = this.viewDate();
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  });

  protected readonly formatted = computed(() => {
    const date = this.selected();
    if (!date) {
      return '';
    }
    return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
  });

  protected readonly days = computed((): DayCell[] => {
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    const today = new Date();
    const selected = this.selected();
    const cells: DayCell[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      cells.push({
        date,
        inMonth: date.getMonth() === month,
        isToday: sameDay(date, today),
        isSelected: selected ? sameDay(date, selected) : false,
      });
    }

    return cells;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.el.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    this.open.update((value) => !value);
    if (this.open() && this.selected()) {
      this.viewDate.set(new Date(this.selected()!));
    }
  }

  protected prevMonth(): void {
    const date = this.viewDate();
    this.viewDate.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const date = this.viewDate();
    this.viewDate.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }

  protected selectDate(date: Date): void {
    this.selected.set(date);
    const value = toDateString(date);
    this.onChange(value);
    this.valueChange.emit(value);
    this.open.set(false);
    this.onTouched();
  }

  writeValue(value: string | Date | null): void {
    const parsed = parseDateValue(value);
    if (parsed) {
      this.selected.set(parsed);
      this.viewDate.set(new Date(parsed));
      return;
    }
    this.selected.set(null);
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

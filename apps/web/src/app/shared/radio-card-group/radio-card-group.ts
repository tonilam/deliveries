import {
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-radio-card-group',
  templateUrl: './radio-card-group.html',
  styleUrl: './radio-card-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioCardGroupComponent),
      multi: true,
    },
  ],
})
export class RadioCardGroupComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly legend = input<string | null>(null);
  readonly options = input.required<RadioCardOption[]>();
  /** Lay options out in a single row (equal-width cards; descriptions hidden). */
  readonly inline = input(false, { transform: booleanAttribute });

  protected selectedValue: string | null = null;
  protected isDisabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.selectedValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected isSelected(optionValue: string): boolean {
    return this.selectedValue === optionValue;
  }

  protected isOptionDisabled(option: RadioCardOption): boolean {
    return this.isDisabled || !!option.disabled;
  }

  protected select(option: RadioCardOption): void {
    if (this.isOptionDisabled(option) || this.selectedValue === option.value) {
      return;
    }
    const optionValue = option.value;
    this.selectedValue = optionValue;
    this.onChange(optionValue);
    this.onTouched();
    this.cdr.markForCheck();
  }
}

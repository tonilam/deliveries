import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  computed,
  input,
  output,
} from '@angular/core';

import { UiAutocompleteOptionDirective } from './autocomplete-option.directive';

type OptionIdFn = (option: unknown, index: number) => string | undefined;
type OptionLabelFn = (option: unknown) => string;

@Component({
  selector: 'ui-autocomplete-field',
  imports: [NgTemplateOutlet],
  template: `
    <div class="ui-autocomplete" [class.ui-autocomplete--compact]="density() === 'compact'">
      <ng-content select="[uiAutocompleteBefore]" />

      @if (label()) {
        <label class="ui-autocomplete__label" [attr.for]="inputId">{{ label() }}</label>
        <ng-container *ngTemplateOutlet="fieldInput" />
      } @else {
        <ng-container *ngTemplateOutlet="fieldInput" />
      }

      @if (menuOpen() && options().length > 0) {
        <ul class="ui-autocomplete__list" role="listbox" [attr.id]="listboxId() ?? null">
          @for (option of options(); track trackOption($index, option); let i = $index) {
            <li
              role="option"
              [attr.id]="optionListId(option, i) ?? null"
              [attr.aria-selected]="
                activeOptionIndex() !== null && activeOptionIndex() === i ? true : null
              "
            >
              @if (optionSlot) {
                <ng-container
                  [ngTemplateOutlet]="optionSlot.template"
                  [ngTemplateOutletContext]="{ $implicit: option, index: i }"
                />
              } @else {
                <button
                  type="button"
                  class="ui-autocomplete__option"
                  [class.ui-autocomplete__option--active]="
                    activeOptionIndex() !== null && activeOptionIndex() === i
                  "
                  [class.ui-autocomplete__option--spread]="optionSpread()"
                  [disabled]="optionDisabled()"
                  (mousedown)="onOptionMouseDown(option, $event)"
                  (click)="onOptionClick(option, $event)"
                >
                  {{ optionText(option) }}
                  @if (optionCode(option); as code) {
                    <span class="ui-autocomplete__code">{{ code }}</span>
                  }
                </button>
              }
            </li>
          }
        </ul>
      }

      <ng-content select="[uiAutocompleteAfter]" />
    </div>

    <ng-template #fieldInput>
      <span class="ui-autocomplete__field" [class.ui-autocomplete__field--clearable]="showClear()">
        <input
          [id]="inputId"
          type="text"
          class="ui-autocomplete__input"
          [value]="query()"
          [disabled]="disabled()"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-expanded]="combobox() ? menuOpen() : null"
          [attr.aria-activedescendant]="combobox() ? activeDescendantId() : null"
          [attr.aria-controls]="combobox() && listboxId() ? listboxId() : null"
          [attr.aria-autocomplete]="combobox() ? 'list' : null"
          [attr.role]="combobox() ? 'combobox' : null"
          autocomplete="off"
          (input)="queryInput.emit($event)"
          (focus)="fieldFocus.emit()"
          (blur)="fieldBlur.emit()"
          (keydown)="fieldKeydown.emit($event)"
        />
        @if (showClear()) {
          <button
            type="button"
            class="ui-autocomplete__clear"
            [disabled]="disabled()"
            (mousedown)="onClearMouseDown($event)"
            [attr.aria-label]="clearAriaLabel()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9 9 15M9 9l6 6" />
            </svg>
          </button>
        }
      </span>
    </ng-template>
  `,
  styleUrl: './autocomplete-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiAutocompleteFieldComponent {
  private static nextId = 0;

  @ContentChild(UiAutocompleteOptionDirective)
  protected optionSlot?: UiAutocompleteOptionDirective;

  protected readonly inputId = `ui-autocomplete-input-${UiAutocompleteFieldComponent.nextId++}`;

  readonly label = input<string | undefined>();
  readonly query = input.required<string>();
  readonly menuOpen = input(false);
  readonly options = input<readonly unknown[]>([]);
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly clearable = input(true);
  readonly clearAriaLabel = input('Clear');
  readonly density = input<'default' | 'compact'>('default');
  readonly combobox = input(false);
  readonly listboxId = input<string | undefined>();
  readonly activeOptionIndex = input<number | null>(null);
  readonly activeDescendantId = input<string | null>(null);
  readonly optionIdFn = input<OptionIdFn | undefined>();
  readonly optionLabelKey = input<string | undefined>();
  readonly optionLabelFn = input<OptionLabelFn | undefined>();
  readonly optionCodeKey = input<string | undefined>();
  readonly optionSpread = input(false);
  readonly optionDisabled = input(false);
  readonly optionMouseEvent = input<'mousedown' | 'click'>('mousedown');

  readonly queryInput = output<Event>();
  readonly fieldFocus = output<void>();
  readonly fieldBlur = output<void>();
  readonly fieldKeydown = output<KeyboardEvent>();
  readonly cleared = output<void>();
  readonly optionSelected = output<unknown>();

  protected readonly showClear = computed(
    () => this.clearable() && !this.disabled() && this.query().trim() !== '',
  );

  protected trackOption(index: number, option: unknown): string | number {
    if (typeof option === 'object' && option !== null && 'id' in option) {
      const id = (option as { id: string | number }).id;
      return id;
    }
    return index;
  }

  protected optionListId(option: unknown, index: number): string | undefined {
    const fn = this.optionIdFn();
    return fn?.(option, index);
  }

  protected optionText(option: unknown): string {
    const fn = this.optionLabelFn();
    if (fn) {
      return fn(option);
    }
    const key = this.optionLabelKey();
    if (key && typeof option === 'object' && option !== null && key in option) {
      return String((option as Record<string, unknown>)[key]);
    }
    return String(option);
  }

  protected optionCode(option: unknown): string | null {
    const key = this.optionCodeKey();
    if (!key || typeof option !== 'object' || option === null || !(key in option)) {
      return null;
    }
    const value = (option as Record<string, unknown>)[key];
    return value == null || value === '' ? null : String(value);
  }

  protected onClearMouseDown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cleared.emit();
  }

  protected onOptionMouseDown(option: unknown, event: Event): void {
    if (this.optionMouseEvent() !== 'mousedown') {
      return;
    }
    event.preventDefault();
    this.optionSelected.emit(option);
  }

  protected onOptionClick(option: unknown, event: Event): void {
    if (this.optionMouseEvent() !== 'click') {
      return;
    }
    event.preventDefault();
    this.optionSelected.emit(option);
  }
}

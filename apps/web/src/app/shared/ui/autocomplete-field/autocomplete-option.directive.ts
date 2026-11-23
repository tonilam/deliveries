import { Directive, TemplateRef, inject } from '@angular/core';

export interface AutocompleteOptionContext<T = unknown> {
  $implicit: T;
  index: number;
}

@Directive({
  selector: '[uiAutocompleteOption]',
})
export class UiAutocompleteOptionDirective<T = unknown> {
  readonly template = inject(TemplateRef<AutocompleteOptionContext<T>>);
}

import { Directive, TemplateRef } from '@angular/core';

export interface AutocompleteOptionContext<T = unknown> {
  $implicit: T;
  index: number;
}

@Directive({
  selector: '[uiAutocompleteOption]',
})
export class UiAutocompleteOptionDirective<T = unknown> {
  constructor(readonly template: TemplateRef<AutocompleteOptionContext<T>>) {}
}

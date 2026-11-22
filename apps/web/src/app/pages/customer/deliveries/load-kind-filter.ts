import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams, SetFilterModel } from 'ag-grid-community';

import {
  DirectLoadKindLabel,
  LOAD_KIND_FILTER_LABELS,
  LOAD_KIND_FILTER_OPTIONS,
} from './load-kind';

@Component({
  selector: 'app-load-kind-filter',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadKindFilter implements IFilterAngularComp {
  private params!: IFilterParams;

  private readonly selected = signal<Record<DirectLoadKindLabel, boolean>>(this.allSelected());

  agInit(params: IFilterParams): void {
    this.params = params;
    this.syncFromModel(null);
  }

  refresh(): boolean {
    return true;
  }

  isFilterActive(): boolean {
    return !LOAD_KIND_FILTER_LABELS.every((label) => this.selected()[label]);
  }

  doesFilterPass(_params: IDoesFilterPassParams): boolean {
    return true;
  }

  getModel(): SetFilterModel | null {
    if (!this.isFilterActive()) {
      return null;
    }

    const values = LOAD_KIND_FILTER_LABELS.filter((label) => this.selected()[label]);
    return { filterType: 'set', values };
  }

  setModel(model: SetFilterModel | null): void {
    this.syncFromModel(model);
  }

  setSelections(selections: Record<DirectLoadKindLabel, boolean>): void {
    this.selected.set({ ...selections });
  }

  selectionSnapshot(): Record<DirectLoadKindLabel, boolean> {
    return { ...this.selected() };
  }

  private syncFromModel(model: SetFilterModel | null): void {
    if (!model?.values?.length) {
      if (model && Array.isArray(model.values) && model.values.length === 0) {
        this.selected.set(this.noneSelected());
        return;
      }
      this.selected.set(this.allSelected());
      return;
    }

    const next = this.noneSelected();
    for (const label of LOAD_KIND_FILTER_LABELS) {
      next[label] = model.values.includes(label);
    }
    this.selected.set(next);
  }

  private allSelected(): Record<DirectLoadKindLabel, boolean> {
    return Object.fromEntries(
      LOAD_KIND_FILTER_OPTIONS.map((option) => [option.label, true]),
    ) as Record<DirectLoadKindLabel, boolean>;
  }

  private noneSelected(): Record<DirectLoadKindLabel, boolean> {
    return Object.fromEntries(
      LOAD_KIND_FILTER_OPTIONS.map((option) => [option.label, false]),
    ) as Record<DirectLoadKindLabel, boolean>;
  }
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams, SetFilterModel } from 'ag-grid-community';

export const REFRIGERATED_FILTER_YES = 'Yes';
export const REFRIGERATED_FILTER_NO = 'No';

export const REFRIGERATED_FILTER_LABELS = [
  REFRIGERATED_FILTER_YES,
  REFRIGERATED_FILTER_NO,
] as const;

@Component({
  selector: 'app-refrigerated-required-filter',
  templateUrl: './refrigerated-required-filter.html',
  styleUrl: './refrigerated-required-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefrigeratedRequiredFilter implements IFilterAngularComp {
  private params!: IFilterParams;

  protected readonly yes = signal(true);
  protected readonly no = signal(true);

  agInit(params: IFilterParams): void {
    this.params = params;
    this.syncFromModel(null);
  }

  refresh(): boolean {
    return true;
  }

  isFilterActive(): boolean {
    return !(this.yes() && this.no());
  }

  doesFilterPass(_params: IDoesFilterPassParams): boolean {
    return true;
  }

  getModel(): SetFilterModel | null {
    if (!this.isFilterActive()) {
      return null;
    }

    const values: string[] = [];
    if (this.yes()) {
      values.push(REFRIGERATED_FILTER_YES);
    }
    if (this.no()) {
      values.push(REFRIGERATED_FILTER_NO);
    }

    return { filterType: 'set', values };
  }

  setModel(model: SetFilterModel | null): void {
    this.syncFromModel(model);
  }

  setSelections(yes: boolean, no: boolean): void {
    this.yes.set(yes);
    this.no.set(no);
  }

  protected onSelectionChange(): void {
    this.params.filterChangedCallback();
  }

  private syncFromModel(model: SetFilterModel | null): void {
    if (!model?.values?.length) {
      if (model && Array.isArray(model.values) && model.values.length === 0) {
        this.yes.set(false);
        this.no.set(false);
        return;
      }
      this.yes.set(true);
      this.no.set(true);
      return;
    }

    this.yes.set(model.values.includes(REFRIGERATED_FILTER_YES));
    this.no.set(model.values.includes(REFRIGERATED_FILTER_NO));
  }
}

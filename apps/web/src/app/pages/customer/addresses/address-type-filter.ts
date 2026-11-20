import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams, IFilterParams, SetFilterModel } from 'ag-grid-community';

export const TYPE_FILTER_COLLECTION = 'Collection';
export const TYPE_FILTER_DELIVERY = 'Delivery';

@Component({
  selector: 'app-address-type-filter',
  templateUrl: './address-type-filter.html',
  styleUrl: './address-type-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressTypeFilter implements IFilterAngularComp {
  private params!: IFilterParams;

  protected readonly collection = signal(true);
  protected readonly delivery = signal(true);

  agInit(params: IFilterParams): void {
    this.params = params;
    this.syncFromModel(null);
  }

  refresh(): boolean {
    return true;
  }

  isFilterActive(): boolean {
    return !(this.collection() && this.delivery());
  }

  doesFilterPass(_params: IDoesFilterPassParams): boolean {
    return true;
  }

  getModel(): SetFilterModel | null {
    if (!this.isFilterActive()) {
      return null;
    }

    const values: string[] = [];
    if (this.collection()) {
      values.push(TYPE_FILTER_COLLECTION);
    }
    if (this.delivery()) {
      values.push(TYPE_FILTER_DELIVERY);
    }

    return { filterType: 'set', values };
  }

  setModel(model: SetFilterModel | null): void {
    this.syncFromModel(model);
  }

  setSelections(collection: boolean, delivery: boolean): void {
    this.collection.set(collection);
    this.delivery.set(delivery);
  }

  protected onSelectionChange(): void {
    this.params.filterChangedCallback();
  }

  private syncFromModel(model: SetFilterModel | null): void {
    if (!model?.values?.length) {
      if (model && Array.isArray(model.values) && model.values.length === 0) {
        this.collection.set(false);
        this.delivery.set(false);
        return;
      }
      this.collection.set(true);
      this.delivery.set(true);
      return;
    }

    this.collection.set(model.values.includes(TYPE_FILTER_COLLECTION));
    this.delivery.set(model.values.includes(TYPE_FILTER_DELIVERY));
  }
}

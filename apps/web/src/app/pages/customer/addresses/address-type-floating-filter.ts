import { NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { IFloatingFilterAngularComp } from 'ag-grid-angular';
import { FilterChangedEvent, IFloatingFilterParams, SetFilterModel } from 'ag-grid-community';

import {
  AddressTypeFilter,
  TYPE_FILTER_COLLECTION,
  TYPE_FILTER_DELIVERY,
} from './address-type-filter';

@Component({
  selector: 'app-address-type-floating-filter',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './address-type-floating-filter.html',
  styleUrl: './address-type-floating-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressTypeFloatingFilter implements IFloatingFilterAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private params!: IFloatingFilterParams<AddressTypeFilter>;

  protected readonly collection = signal(true);
  protected readonly delivery = signal(true);
  protected readonly panelOpen = signal(false);
  protected readonly panelStyle = signal<Record<string, string>>({});

  protected readonly summary = computed(() => {
    const collection = this.collection();
    const delivery = this.delivery();

    if (collection && delivery) {
      return 'All types';
    }
    if (!collection && !delivery) {
      return 'No types';
    }
    if (collection) {
      return TYPE_FILTER_COLLECTION;
    }
    return TYPE_FILTER_DELIVERY;
  });

  protected readonly filterActive = computed(() => !(this.collection() && this.delivery()));

  agInit(params: IFloatingFilterParams<AddressTypeFilter>): void {
    this.params = params;
    this.onParentModelChanged(params.currentParentModel() as SetFilterModel | null);
  }

  refresh(params: IFloatingFilterParams<AddressTypeFilter>): boolean {
    this.params = params;
    this.onParentModelChanged(params.currentParentModel() as SetFilterModel | null);
    return true;
  }

  onParentModelChanged(
    parentModel: SetFilterModel | null,
    _filterChangedEvent?: FilterChangedEvent | null,
  ): void {
    if (!parentModel?.values?.length) {
      if (parentModel && Array.isArray(parentModel.values) && parentModel.values.length === 0) {
        this.collection.set(false);
        this.delivery.set(false);
      } else {
        this.collection.set(true);
        this.delivery.set(true);
      }
    } else {
      this.collection.set(parentModel.values.includes(TYPE_FILTER_COLLECTION));
      this.delivery.set(parentModel.values.includes(TYPE_FILTER_DELIVERY));
    }
    this.cdr.markForCheck();
  }

  protected togglePanel(event: Event): void {
    event.stopPropagation();
    const nextOpen = !this.panelOpen();
    this.panelOpen.set(nextOpen);
    if (nextOpen) {
      this.positionPanel();
    }
  }

  protected onCollectionChange(checked: boolean): void {
    this.collection.set(checked);
    this.pushToParent();
  }

  protected onDeliveryChange(checked: boolean): void {
    this.delivery.set(checked);
    this.pushToParent();
  }

  protected onPanelClick(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.closePanel();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this.panelOpen()) {
      this.positionPanel();
    }
  }

  @HostListener('document:scroll')
  protected onDocumentScroll(): void {
    this.closePanel();
  }

  private closePanel(): void {
    if (this.panelOpen()) {
      this.panelOpen.set(false);
      this.cdr.markForCheck();
    }
  }

  private positionPanel(): void {
    const trigger = this.triggerRef()?.nativeElement;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 168);

    this.panelStyle.set({
      position: 'fixed',
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      minWidth: `${minWidth}px`,
      zIndex: '10000',
    });
    this.cdr.markForCheck();
  }

  private pushToParent(): void {
    const collection = this.collection();
    const delivery = this.delivery();

    this.params.parentFilterInstance((parent) => {
      parent.setSelections(collection, delivery);
    });
    this.params.filterParams.filterChangedCallback?.();
  }
}

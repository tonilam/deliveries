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
  REFRIGERATED_FILTER_NO,
  REFRIGERATED_FILTER_YES,
  RefrigeratedRequiredFilter,
} from './refrigerated-required-filter';

@Component({
  selector: 'app-refrigerated-required-floating-filter',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './refrigerated-required-floating-filter.html',
  styleUrl: './refrigerated-required-floating-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefrigeratedRequiredFloatingFilter implements IFloatingFilterAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private params!: IFloatingFilterParams<RefrigeratedRequiredFilter>;

  protected readonly yes = signal(true);
  protected readonly no = signal(true);
  protected readonly panelOpen = signal(false);
  protected readonly panelStyle = signal<Record<string, string>>({});

  protected readonly summary = computed(() => {
    const yes = this.yes();
    const no = this.no();

    if (yes && no) {
      return 'All';
    }
    if (!yes && !no) {
      return 'None';
    }
    if (yes) {
      return REFRIGERATED_FILTER_YES;
    }
    return REFRIGERATED_FILTER_NO;
  });

  protected readonly filterActive = computed(() => !(this.yes() && this.no()));

  agInit(params: IFloatingFilterParams<RefrigeratedRequiredFilter>): void {
    this.params = params;
    this.onParentModelChanged(params.currentParentModel() as SetFilterModel | null);
  }

  refresh(params: IFloatingFilterParams<RefrigeratedRequiredFilter>): boolean {
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
        this.yes.set(false);
        this.no.set(false);
      } else {
        this.yes.set(true);
        this.no.set(true);
      }
    } else {
      this.yes.set(parentModel.values.includes(REFRIGERATED_FILTER_YES));
      this.no.set(parentModel.values.includes(REFRIGERATED_FILTER_NO));
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

  protected onYesChange(checked: boolean): void {
    this.yes.set(checked);
    this.pushToParent();
  }

  protected onNoChange(checked: boolean): void {
    this.no.set(checked);
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
    const yes = this.yes();
    const no = this.no();

    this.params.parentFilterInstance((parent) => {
      parent.setSelections(yes, no);
    });
    this.params.filterParams.filterChangedCallback?.();
  }
}

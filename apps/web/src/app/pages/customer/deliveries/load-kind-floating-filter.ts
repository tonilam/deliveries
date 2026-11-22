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
  DirectLoadKindLabel,
  LOAD_KIND_FILTER_LABELS,
  LOAD_KIND_FILTER_OPTIONS,
} from './load-kind';
import { LoadKindFilter } from './load-kind-filter';

@Component({
  selector: 'app-load-kind-floating-filter',
  imports: [NgStyle],
  templateUrl: './load-kind-floating-filter.html',
  styleUrl: './load-kind-floating-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadKindFloatingFilter implements IFloatingFilterAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private params!: IFloatingFilterParams<LoadKindFilter>;

  protected readonly options = LOAD_KIND_FILTER_OPTIONS;
  protected readonly selected = signal<Record<DirectLoadKindLabel, boolean>>(this.allSelected());
  protected readonly panelOpen = signal(false);
  protected readonly panelStyle = signal<Record<string, string>>({});

  protected readonly summary = computed(() => {
    const labels = LOAD_KIND_FILTER_LABELS.filter((label) => this.selected()[label]);
    if (labels.length === 0) {
      return 'None';
    }
    if (labels.length === LOAD_KIND_FILTER_LABELS.length) {
      return 'All';
    }
    if (labels.length === 1) {
      return labels[0]!;
    }
    return `${labels.length} selected`;
  });

  protected readonly filterActive = computed(
    () => !LOAD_KIND_FILTER_LABELS.every((label) => this.selected()[label]),
  );

  agInit(params: IFloatingFilterParams<LoadKindFilter>): void {
    this.params = params;
    this.onParentModelChanged(params.currentParentModel() as SetFilterModel | null);
  }

  refresh(params: IFloatingFilterParams<LoadKindFilter>): boolean {
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
        this.selected.set(this.noneSelected());
      } else {
        this.selected.set(this.allSelected());
      }
    } else {
      const next = this.noneSelected();
      for (const label of LOAD_KIND_FILTER_LABELS) {
        next[label] = parentModel.values.includes(label);
      }
      this.selected.set(next);
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

  protected onOptionChange(label: DirectLoadKindLabel, checked: boolean): void {
    this.selected.update((current) => ({ ...current, [label]: checked }));
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
    const snapshot = { ...this.selected() };
    this.params.parentFilterInstance((parent) => {
      parent.setSelections(snapshot);
    });
    this.params.filterParams.filterChangedCallback?.();
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

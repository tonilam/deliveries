import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { isLoadDetailRow, LoadGridRow, LoadRow } from './load.types';

export interface LoadExpandCellParams {
  isExpanded: (loadId: number) => boolean;
  toggle: (loadId: number) => void;
  hasChildren: (load: LoadRow) => boolean;
}

type Params = ICellRendererParams<LoadGridRow> & LoadExpandCellParams;

@Component({
  selector: 'app-load-expand-cell',
  template: `
    @if (showToggle) {
      <button
        type="button"
        class="load-expand-btn"
        [attr.aria-expanded]="expanded"
        [attr.aria-label]="expanded ? 'Collapse child loads' : 'Expand child loads'"
        (click)="onToggle($event)"
      >
        {{ expanded ? '▼' : '▶' }}
      </button>
    }
  `,
  styles: `
    .load-expand-btn {
      font: inherit;
      padding: 0.15rem 0.35rem;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #475569;
      line-height: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadExpandCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected showToggle = false;
  protected expanded = false;
  private loadId = 0;
  private toggleFn: (loadId: number) => void = () => undefined;

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    const data = params.data;
    if (!data || isLoadDetailRow(data)) {
      this.showToggle = false;
      this.cdr.markForCheck();
      return true;
    }

    this.toggleFn = params.toggle ?? (() => undefined);
    this.loadId = data.id;
    this.showToggle = params.hasChildren?.(data) ?? false;
    this.expanded = params.isExpanded?.(data.id) ?? false;
    this.cdr.markForCheck();
    return true;
  }

  protected onToggle(event: Event): void {
    event.stopPropagation();
    this.toggleFn(this.loadId);
  }
}

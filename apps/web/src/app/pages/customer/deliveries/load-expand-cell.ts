import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import {
  childLoadCanExpand,
  isLoadChildItemDetailRow,
  isLoadDetailRow,
  LoadChildGridRow,
  LoadGridRow,
  LoadRow,
} from './load.types';

export interface LoadExpandCellParams {
  isExpanded: (loadId: number) => boolean;
  toggle: (loadId: number) => void;
  /** @deprecated use canExpand */
  hasChildren?: (load: LoadRow) => boolean;
  canExpand?: (load: LoadRow) => boolean;
  expandTarget?: 'children' | 'items' | 'auto';
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
        [attr.aria-label]="ariaLabel"
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
  protected ariaLabel = '';
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

    const row = data as LoadRow;
    this.toggleFn = params.toggle ?? (() => undefined);
    this.loadId = row.id;
    const canExpandFn =
      params.canExpand ??
      params.hasChildren ??
      ((load: LoadRow) => (load.children?.length ?? 0) > 0);
    this.showToggle = canExpandFn(row);
    this.lastRow = row;
    this.expandTarget = params.expandTarget ?? 'auto';
    this.expanded = params.isExpanded?.(row.id) ?? false;
    this.ariaLabel = this.expandAriaLabel(row, this.expandTarget, this.expanded);
    this.cdr.markForCheck();
    return true;
  }

  protected onToggle(event: Event): void {
    event.stopPropagation();
    this.expanded = !this.expanded;
    const row = this.lastRow;
    if (row) {
      this.ariaLabel = this.expandAriaLabel(row, this.expandTarget, this.expanded);
    }
    this.cdr.markForCheck();
    this.toggleFn(this.loadId);
  }

  private lastRow: LoadRow | null = null;
  private expandTarget: 'children' | 'items' | 'auto' = 'auto';

  private expandAriaLabel(
    load: LoadRow,
    target: 'children' | 'items' | 'auto',
    expanded: boolean,
  ): string {
    const showsChildren =
      target === 'children' || (target === 'auto' && (load.children?.length ?? 0) > 0);
    if (showsChildren) {
      return expanded ? 'Collapse child loads' : 'Expand child loads';
    }
    return expanded ? 'Collapse items' : 'Expand items';
  }
}

export interface LoadChildExpandCellParams {
  isExpanded: (loadId: number) => boolean;
  toggle: (loadId: number) => void;
}

type ChildParams = ICellRendererParams<LoadChildGridRow> & LoadChildExpandCellParams;

@Component({
  selector: 'app-load-child-expand-cell',
  template: `
    @if (showToggle) {
      <button
        type="button"
        class="load-expand-btn"
        [attr.aria-expanded]="expanded"
        [attr.aria-label]="expanded ? 'Collapse items' : 'Expand items'"
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
export class LoadChildExpandCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected showToggle = false;
  protected expanded = false;
  private loadId = 0;
  private toggleFn: (loadId: number) => void = () => undefined;

  agInit(params: ChildParams): void {
    this.refresh(params);
  }

  refresh(params: ChildParams): boolean {
    const data = params.data;
    if (!data || isLoadChildItemDetailRow(data)) {
      this.showToggle = false;
      this.cdr.markForCheck();
      return true;
    }

    const row = data as LoadRow;
    this.toggleFn = params.toggle ?? (() => undefined);
    this.loadId = row.id;
    this.showToggle = childLoadCanExpand(row);
    this.expanded = params.isExpanded?.(row.id) ?? false;
    this.cdr.markForCheck();
    return true;
  }

  protected onToggle(event: Event): void {
    event.stopPropagation();
    this.expanded = !this.expanded;
    this.cdr.markForCheck();
    this.toggleFn(this.loadId);
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import {
  isLoadDetailRow,
  LoadGridRow,
  LoadRow,
  parentDisplayItemCount,
  parentHasItemsOnParentLoad,
} from './load.types';

@Component({
  selector: 'app-load-item-count-cell',
  template: `
    @if (showCount) {
      @if (warn) {
        <div class="load-item-count">
          <span class="load-item-count__value">{{ total }}</span>
          <span class="load-item-count__warn">Check items</span>
        </div>
      } @else {
        <span class="load-item-count__value">{{ total }}</span>
      }
    }
  `,
  styles: `
    .load-item-count {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
      padding: 0.1rem 0;
    }

    .load-item-count__value {
      font-variant-numeric: tabular-nums;
    }

    .load-item-count__warn {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #b91c1c;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadItemCountCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected showCount = false;
  protected total = 0;
  protected warn = false;

  agInit(params: ICellRendererParams<LoadGridRow>): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams<LoadGridRow>): boolean {
    const data = params.data;
    if (!data || isLoadDetailRow(data)) {
      this.showCount = false;
      this.warn = false;
      this.cdr.markForCheck();
      return true;
    }

    this.showCount = true;
    const row = data as LoadRow;
    this.total = parentDisplayItemCount(row);
    this.warn = parentHasItemsOnParentLoad(row);
    this.cdr.markForCheck();
    return true;
  }
}

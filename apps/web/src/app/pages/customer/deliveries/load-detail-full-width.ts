import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { LoadChildrenFullWidth, LoadChildrenFullWidthParams } from './load-children-full-width';
import { LoadItemsFullWidth, LoadItemsFullWidthParams } from './load-items-full-width';
import { isLoadChildrenDetail, isLoadDetailRow, LoadGridRow } from './load.types';

export type LoadDetailFullWidthParams = LoadChildrenFullWidthParams & LoadItemsFullWidthParams;

type Params = ICellRendererParams<LoadGridRow> & LoadDetailFullWidthParams;

@Component({
  selector: 'app-load-detail-full-width',
  imports: [LoadChildrenFullWidth, LoadItemsFullWidth],
  template: `
    @if (cellParams; as p) {
      @if (p.data && isLoadDetailRow(p.data) && isLoadChildrenDetail(p.data)) {
        <app-load-children-full-width [hostParams]="p" />
      } @else if (p.data && isLoadDetailRow(p.data) && p.data.kind === 'items') {
        <app-load-items-full-width [hostParams]="p" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadDetailFullWidth implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected cellParams: Params | null = null;
  protected readonly isLoadDetailRow = isLoadDetailRow;
  protected readonly isLoadChildrenDetail = isLoadChildrenDetail;

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    this.cellParams = params;
    this.cdr.markForCheck();
    return true;
  }
}

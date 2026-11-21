import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { LoadAddressKind, loadAddressParts } from './load-address';
import { LoadChildGridRow, LoadGridRow, LoadRow } from './load.types';

function isAddressCellEmptyRow(data: LoadGridRow | LoadChildGridRow): boolean {
  return 'detailRow' in data || 'childDetailRow' in data;
}

export interface LoadAddressCellParams {
  kind: LoadAddressKind;
}

type Params = ICellRendererParams<LoadGridRow | LoadChildGridRow> & LoadAddressCellParams;

@Component({
  selector: 'app-load-address-cell',
  template: `
    @if (empty) {
      <span class="load-address-cell__empty">—</span>
    } @else {
      <div class="load-address-cell">
        @if (name) {
          <div class="load-address-cell__name">{{ name }}</div>
        }
        @if (line) {
          <div class="load-address-cell__line">{{ line }}</div>
        }
      </div>
    }
  `,
  styles: `
    .load-address-cell {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.125rem;
      line-height: 1.25;
      min-width: 0;
      max-width: 100%;
      padding: 0.15rem 0;
    }

    .load-address-cell__name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .load-address-cell__line {
      font-size: 0.6875rem;
      font-weight: 400;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .load-address-cell__empty {
      color: #64748b;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadAddressCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected empty = true;
  protected name: string | null = null;
  protected line: string | null = null;
  private kind: LoadAddressKind = 'delivery';

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    this.kind = params.kind ?? 'delivery';
    const data = params.data;

    if (!data || isAddressCellEmptyRow(data)) {
      this.empty = true;
      this.name = null;
      this.line = null;
      this.cdr.markForCheck();
      return true;
    }

    const parts = loadAddressParts(data as LoadRow, this.kind);
    this.name = parts.name;
    this.line = parts.line;
    this.empty = !parts.name && !parts.line;
    this.cdr.markForCheck();
    return true;
  }
}

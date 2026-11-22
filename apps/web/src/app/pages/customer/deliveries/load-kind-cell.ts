import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { UiBadgeComponent } from '../../../shared/ui/badge/badge';
import {
  DIRECT_LOAD_KIND_BADGE_COLOR,
  DIRECT_LOAD_KIND_BADGE_SIZE,
  directLoadKind,
} from './load-kind';
import { isLoadDetailRow, LoadGridRow, LoadRow } from './load.types';

@Component({
  selector: 'app-load-kind-cell',
  imports: [UiBadgeComponent],
  template: `
    @if (showKind) {
      <ui-badge [color]="badgeColor" [size]="badgeSize">{{ kind }}</ui-badge>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadKindCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly badgeColor = DIRECT_LOAD_KIND_BADGE_COLOR;
  protected readonly badgeSize = DIRECT_LOAD_KIND_BADGE_SIZE;
  protected showKind = false;
  protected kind = '';

  agInit(params: ICellRendererParams<LoadGridRow>): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams<LoadGridRow>): boolean {
    const data = params.data;
    if (!data || isLoadDetailRow(data)) {
      this.showKind = false;
      this.cdr.markForCheck();
      return true;
    }

    this.showKind = true;
    this.kind = directLoadKind(data as LoadRow);
    this.cdr.markForCheck();
    return true;
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import {
  ColDef,
  FirstDataRenderedEvent,
  GridReadyEvent,
  ICellRendererParams,
  themeQuartz,
} from 'ag-grid-community';

import { LoadActionItem, LoadActionsCell } from './load-actions-cell';
import { isLoadDetailRow, LoadGridRow, LoadRow } from './load.types';

export interface LoadChildrenFullWidthParams {
  onActionsFor: (child: LoadRow) => LoadActionItem[];
  onDetailHeight: (parentLoadId: number, height: number) => void;
}

type Params = ICellRendererParams<LoadGridRow> & LoadChildrenFullWidthParams;

@Component({
  selector: 'app-load-children-full-width',
  imports: [AgGridAngular],
  template: `
    <div class="load-children-panel" #panel>
      <p class="load-children-panel__title">Add Drop &amp; X Dock loads</p>
      <ag-grid-angular
        class="load-children-grid"
        [theme]="theme"
        [rowData]="rows()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        domLayout="autoHeight"
        (gridReady)="onChildGridReady($event)"
        (firstDataRendered)="onChildFirstDataRendered()"
      />
    </div>
  `,
  styles: `
    .load-children-panel {
      padding: 0.75rem 1rem 1rem 2.5rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .load-children-panel__title {
      margin: 0 0 0.5rem;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #475569;
    }
    .load-children-grid {
      display: block;
      width: 100%;
    }

    :host ::ng-deep .load-children-grid .ag-body-viewport,
    :host ::ng-deep .load-children-grid .ag-center-cols-viewport {
      overflow-y: visible !important;
      max-height: none !important;
    }

    :host ::ng-deep .load-children-grid .ag-body-vertical-scroll {
      display: none !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadChildrenFullWidth implements ICellRendererAngularComp {
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly theme = themeQuartz;
  protected readonly rows = signal<LoadRow[]>([]);
  private actionsFor: (child: LoadRow) => LoadActionItem[] = () => [];
  private onDetailHeight: (parentLoadId: number, height: number) => void = () => {};
  private gridParams: Params | null = null;

  constructor() {
    effect(() => {
      this.rows();
      queueMicrotask(() => this.syncDetailHeight());
    });
  }

  protected readonly defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
    filter: false,
  };

  protected columnDefs: ColDef<LoadRow>[] = [];

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    this.gridParams = params;
    this.onDetailHeight = params.onDetailHeight ?? (() => {});
    const data = params.data;
    this.rows.set(data && isLoadDetailRow(data) ? data.children : []);
    this.actionsFor = params.onActionsFor ?? (() => []);
    this.columnDefs = this.buildColumns();
    queueMicrotask(() => this.syncDetailHeight());
    return true;
  }

  protected onChildGridReady(_event: GridReadyEvent<LoadRow>): void {
    this.syncDetailHeight();
  }

  protected onChildFirstDataRendered(): void {
    this.syncDetailHeight();
  }

  private syncDetailHeight(): void {
    const params = this.gridParams;
    const data = params?.data;
    const panel = this.panelRef()?.nativeElement;
    if (!params || !data || !isLoadDetailRow(data) || !panel) {
      return;
    }

    const height = Math.ceil(panel.getBoundingClientRect().height);
    if (height <= 0) {
      return;
    }

    params.node.setRowHeight(height);
    this.onDetailHeight(data.detailParentId, height);
    params.api.onRowHeightChanged();
  }

  private buildColumns(): ColDef<LoadRow>[] {
    const actionsFor = this.actionsFor;
    return [
      { field: 'type_label', headerName: 'Type', flex: 0.8, minWidth: 100 },
      { field: 'xdock', headerName: 'X dock', flex: 1, minWidth: 140 },
      { field: 'delivery', headerName: 'Delivery', flex: 1.2, minWidth: 160 },
      { field: 'secondary_provider', headerName: 'Secondary provider', flex: 1, minWidth: 140 },
      { field: 'pallet_count', headerName: 'Pallets', width: 90 },
      { field: 'item_count', headerName: 'Items', width: 80 },
      {
        headerName: 'Actions',
        width: 100,
        cellRenderer: LoadActionsCell,
        cellRendererParams: {
          actionsFor: (data: LoadRow) => actionsFor(data),
        },
      },
    ];
  }
}

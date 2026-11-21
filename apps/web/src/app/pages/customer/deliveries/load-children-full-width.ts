import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, themeQuartz } from 'ag-grid-community';

import { LoadActionItem, LoadActionsCell } from './load-actions-cell';
import { LoadRow } from './load.types';

export interface LoadChildrenFullWidthParams {
  onActionsFor: (child: LoadRow) => LoadActionItem[];
}

type Params = ICellRendererParams<LoadRow> & { children?: LoadRow[] } & LoadChildrenFullWidthParams;

@Component({
  selector: 'app-load-children-full-width',
  imports: [AgGridAngular],
  template: `
    <div class="load-children-panel">
      <p class="load-children-panel__title">Add Drop &amp; X Dock loads</p>
      <ag-grid-angular
        class="load-children-grid"
        [theme]="theme"
        [rowData]="rows()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        domLayout="autoHeight"
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadChildrenFullWidth implements ICellRendererAngularComp {
  protected readonly theme = themeQuartz;
  protected readonly rows = signal<LoadRow[]>([]);
  private actionsFor: (child: LoadRow) => LoadActionItem[] = () => [];

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
    this.rows.set(params.data?.children ?? []);
    this.actionsFor = params.onActionsFor ?? (() => []);
    this.columnDefs = this.buildColumns();
    return true;
  }

  private buildColumns(): ColDef<LoadRow>[] {
    const actionsFor = this.actionsFor;
    return [
      { field: 'type_label', headerName: 'Type', flex: 0.8, minWidth: 100 },
      { field: 'delivery', headerName: 'Delivery', flex: 1.2, minWidth: 160 },
      { field: 'xdock', headerName: 'X dock', flex: 1, minWidth: 140 },
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

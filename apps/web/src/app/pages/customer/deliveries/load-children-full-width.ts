import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import {
  ColDef,
  FirstDataRenderedEvent,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  IsFullWidthRowParams,
  RowHeightParams,
  themeQuartz,
} from 'ag-grid-community';

import { LoadActionItem, LoadActionsCell } from './load-actions-cell';
import { LoadChildExpandCell } from './load-expand-cell';
import { LoadItemsFullWidth } from './load-items-full-width';
import {
  isLoadChildItemDetailRow,
  isLoadChildrenDetail,
  isLoadDetailRow,
  LoadChildGridRow,
  LoadGridRow,
  LoadRow,
} from './load.types';

export interface LoadChildrenFullWidthParams {
  onActionsFor: (child: LoadRow) => LoadActionItem[];
  onDetailHeight: (parentLoadId: number, height: number) => void;
}

type Params = ICellRendererParams<LoadGridRow> & LoadChildrenFullWidthParams;

@Component({
  selector: 'app-load-children-full-width',
  imports: [AgGridAngular, LoadChildExpandCell, LoadActionsCell, LoadItemsFullWidth],
  template: `
    <div class="load-children-panel" #panel>
      <p class="load-children-panel__title">Add Drop &amp; X Dock loads</p>
      <ag-grid-angular
        class="load-children-grid"
        [theme]="theme"
        [rowData]="gridRowData()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        domLayout="autoHeight"
        [isFullWidthRow]="isFullWidthRow"
        [fullWidthCellRenderer]="itemsFullWidthRenderer"
        [fullWidthCellRendererParams]="itemsFullWidthParams"
        [getRowId]="getRowId"
        [getRowHeight]="getRowHeight"
        [embedFullWidthRows]="true"
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
  readonly hostParams = input<Params | null>(null);

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly theme = themeQuartz;
  protected readonly children = signal<LoadRow[]>([]);
  protected readonly expandedChildLoadIds = signal<Set<number>>(new Set());
  protected readonly childItemDetailHeights = signal<Record<number, number>>({});

  protected readonly gridRowData = computed<LoadChildGridRow[]>(() => {
    const rows: LoadChildGridRow[] = [];
    const expanded = this.expandedChildLoadIds();
    for (const child of this.children()) {
      rows.push(child);
      if (expanded.has(child.id) && child.item_count > 0) {
        rows.push({
          childDetailRow: true,
          loadId: child.id,
          itemCount: child.item_count,
        });
      }
    }
    return rows;
  });

  protected readonly itemsFullWidthRenderer = LoadItemsFullWidth;

  protected readonly itemsFullWidthParams = {
    onDetailHeight: (loadId: number, height: number) => {
      this.childItemDetailHeights.update((current) => {
        if (current[loadId] === height) {
          return current;
        }
        return { ...current, [loadId]: height };
      });
      queueMicrotask(() => this.syncDetailHeight());
    },
  };

  private actionsFor: (child: LoadRow) => LoadActionItem[] = () => [];
  private onDetailHeight: (parentLoadId: number, height: number) => void = () => {};
  private gridParams: Params | null = null;
  private childGridApi: GridApi<LoadChildGridRow> | null = null;
  protected columnDefs: ColDef<LoadChildGridRow>[] = [];

  constructor() {
    effect(() => {
      this.hostParams();
      const host = this.hostParams();
      if (host) {
        this.applyParams(host);
      }
    });

    effect(() => {
      this.children();
      this.gridRowData();
      this.childItemDetailHeights();
      this.expandedChildLoadIds();
      queueMicrotask(() => {
        this.childGridApi?.refreshCells({ columns: ['expand'], force: true });
        this.syncDetailHeight();
      });
    });
  }

  protected readonly defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
    filter: false,
  };

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    this.applyParams(params);
    return true;
  }

  protected readonly isFullWidthRow = (params: IsFullWidthRowParams<LoadChildGridRow>) =>
    params.rowNode.data !== undefined && isLoadChildItemDetailRow(params.rowNode.data);

  protected readonly getRowId = (params: { data: LoadChildGridRow }): string => {
    if (isLoadChildItemDetailRow(params.data)) {
      return `child-items-${params.data.loadId}`;
    }
    return `child-load-${params.data.id}`;
  };

  protected readonly getRowHeight = (params: RowHeightParams<LoadChildGridRow>) => {
    const data = params.data;
    if (data && isLoadChildItemDetailRow(data)) {
      return this.childItemDetailHeights()[data.loadId] ?? 56 + data.itemCount * 42;
    }
    return undefined;
  };

  protected onChildGridReady(event: GridReadyEvent<LoadChildGridRow>): void {
    this.childGridApi = event.api;
    this.syncDetailHeight();
  }

  protected onChildFirstDataRendered(_event?: FirstDataRenderedEvent<LoadChildGridRow>): void {
    this.syncDetailHeight();
  }

  private applyParams(params: Params): void {
    this.gridParams = params;
    this.onDetailHeight = params.onDetailHeight ?? (() => {});
    const data = params.data;
    if (data && isLoadDetailRow(data) && isLoadChildrenDetail(data)) {
      this.children.set(data.children);
    } else {
      this.children.set([]);
    }
    this.actionsFor = params.onActionsFor ?? (() => []);
    this.columnDefs = this.buildColumns();
    queueMicrotask(() => this.syncDetailHeight());
  }

  private toggleChildExpand(loadId: number): void {
    this.expandedChildLoadIds.update((current) => {
      const next = new Set(current);
      if (next.has(loadId)) {
        next.delete(loadId);
        this.childItemDetailHeights.update((heights) => {
          if (!(loadId in heights)) {
            return heights;
          }
          const updated = { ...heights };
          delete updated[loadId];
          return updated;
        });
      } else {
        next.add(loadId);
      }
      return next;
    });
  }

  private syncDetailHeight(): void {
    const params = this.gridParams;
    const data = params?.data;
    const panel = this.panelRef()?.nativeElement;
    if (!params || !data || !isLoadDetailRow(data) || !isLoadChildrenDetail(data) || !panel) {
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

  private buildColumns(): ColDef<LoadChildGridRow>[] {
    const actionsFor = this.actionsFor;
    const isChildExpanded = (id: number) => this.expandedChildLoadIds().has(id);
    const toggleChild = (id: number) => this.toggleChildExpand(id);
    return [
      {
        colId: 'expand',
        headerName: '',
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        cellRenderer: LoadChildExpandCell,
        cellRendererParams: {
          isExpanded: isChildExpanded,
          toggle: toggleChild,
        },
      },
      {
        field: 'type_label',
        headerName: 'Type',
        flex: 0.8,
        minWidth: 100,
        valueGetter: (p) => (isLoadChildItemDetailRow(p.data!) ? '' : p.data?.type_label),
      },
      {
        field: 'xdock',
        headerName: 'X dock',
        flex: 1,
        minWidth: 140,
        valueGetter: (p) => (isLoadChildItemDetailRow(p.data!) ? '' : (p.data?.xdock ?? '')),
      },
      {
        field: 'delivery',
        headerName: 'Delivery',
        flex: 1.2,
        minWidth: 160,
        valueGetter: (p) => (isLoadChildItemDetailRow(p.data!) ? '' : (p.data?.delivery ?? '')),
      },
      {
        field: 'secondary_provider',
        headerName: 'Secondary provider',
        flex: 1,
        minWidth: 140,
        valueGetter: (p) =>
          isLoadChildItemDetailRow(p.data!) ? '' : (p.data?.secondary_provider ?? ''),
      },
      {
        field: 'pallet_count',
        headerName: 'Pallets',
        width: 90,
        valueGetter: (p) => (isLoadChildItemDetailRow(p.data!) ? null : p.data?.pallet_count),
      },
      {
        field: 'item_count',
        headerName: 'Items',
        width: 80,
        valueGetter: (p) => (isLoadChildItemDetailRow(p.data!) ? null : p.data?.item_count),
      },
      {
        headerName: 'Actions',
        width: 100,
        cellRenderer: LoadActionsCell,
        cellRendererParams: {
          actionsFor: (data: LoadChildGridRow) =>
            isLoadChildItemDetailRow(data) ? [] : actionsFor(data),
        },
      },
    ];
  }
}

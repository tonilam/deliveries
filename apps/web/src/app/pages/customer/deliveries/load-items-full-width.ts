import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
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
import { catchError, of } from 'rxjs';

import { displayUnitLabel, formatWeightForDisplay, ItemRow } from './item-format';
import {
  isLoadChildItemDetailRow,
  LoadChildGridRow,
  LoadChildItemDetailRow,
  LoadGridRow,
  LoadItemsDetailRow,
} from './load.types';

const ITEMS_PER_PAGE = 200;

interface ItemsListResponse {
  items: ItemRow[];
  meta: { total: number };
}

export interface LoadItemsFullWidthParams {
  onDetailHeight?: (detailParentId: number, height: number) => void;
}

type MainParams = ICellRendererParams<LoadGridRow> & LoadItemsFullWidthParams;
type ChildParams = ICellRendererParams<LoadChildGridRow> & LoadItemsFullWidthParams;
type Params = MainParams | ChildParams;

function detailMeta(
  data: LoadGridRow | LoadChildGridRow | undefined,
): { loadId: number; detailParentId: number } | null {
  if (!data) {
    return null;
  }
  if (isLoadChildItemDetailRow(data as LoadChildGridRow)) {
    const row = data as LoadChildItemDetailRow;
    return { loadId: row.loadId, detailParentId: row.loadId };
  }
  if ('detailRow' in data && data.detailRow === true && data.kind === 'items') {
    const row = data as LoadItemsDetailRow;
    return { loadId: row.loadId, detailParentId: row.detailParentId };
  }
  return null;
}

@Component({
  selector: 'app-load-items-full-width',
  imports: [AgGridAngular],
  template: `
    <div class="load-items-panel" #panel>
      <p class="load-items-panel__title">Items on load #{{ loadId() }}</p>
      @if (truncated()) {
        <p class="load-items-panel__note">
          Showing {{ items().length }} of {{ total() }} items. Use Manage items to see all.
        </p>
      }
      @if (loading()) {
        <p class="load-items-panel__status">Loading…</p>
      } @else if (error()) {
        <p class="load-items-panel__error" role="alert">{{ error() }}</p>
      } @else if (items().length === 0) {
        <p class="load-items-panel__status">No items on this load.</p>
      } @else {
        <ag-grid-angular
          class="load-items-grid"
          [theme]="theme"
          [rowData]="items()"
          [columnDefs]="columnDefs"
          [defaultColDef]="defaultColDef"
          domLayout="autoHeight"
          (gridReady)="onItemsGridReady($event)"
          (firstDataRendered)="onItemsFirstDataRendered()"
        />
      }
    </div>
  `,
  styles: `
    .load-items-panel {
      padding: 0.75rem 1rem 1rem 2.5rem;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
    }
    .load-items-panel__title {
      margin: 0 0 0.5rem;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #475569;
    }
    .load-items-panel__note,
    .load-items-panel__status {
      margin: 0 0 0.5rem;
      font-size: 0.8125rem;
      color: #64748b;
    }
    .load-items-panel__error {
      margin: 0;
      color: #b91c1c;
      font-size: 0.875rem;
    }
    .load-items-grid {
      display: block;
      width: 100%;
    }

    :host ::ng-deep .load-items-grid .ag-body-viewport,
    :host ::ng-deep .load-items-grid .ag-center-cols-viewport {
      overflow-y: visible !important;
      max-height: none !important;
    }

    :host ::ng-deep .load-items-grid .ag-body-vertical-scroll {
      display: none !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadItemsFullWidth implements ICellRendererAngularComp {
  readonly hostParams = input<Params | null>(null);

  private readonly http = inject(HttpClient);
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly theme = themeQuartz;
  protected readonly loadId = signal(0);
  protected readonly items = signal<ItemRow[]>([]);
  protected readonly total = signal(0);
  protected readonly truncated = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private gridParams: Params | null = null;
  private detailParentId = 0;
  private onDetailHeight: (detailParentId: number, height: number) => void = () => {};
  private fetchGeneration = 0;

  protected readonly defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
    filter: false,
  };

  protected readonly columnDefs: ColDef<ItemRow>[] = [
    { field: 'good_type', headerName: 'Goods type', flex: 1, minWidth: 120 },
    {
      headerName: 'Weight',
      flex: 0.8,
      minWidth: 100,
      valueGetter: (params) => {
        const item = params.data;
        if (!item) {
          return '';
        }
        const weight = formatWeightForDisplay(item.weight_tonnes, item.display_unit);
        return `${weight} ${displayUnitLabel(item.display_unit)}`;
      },
    },
    {
      field: 'order_number',
      headerName: 'Order number',
      flex: 1,
      minWidth: 100,
      valueGetter: (params) => params.data?.order_number ?? '—',
    },
    {
      field: 'connote',
      headerName: 'Connote',
      flex: 1,
      minWidth: 100,
      valueGetter: (params) => params.data?.connote ?? '—',
    },
  ];

  constructor() {
    effect(() => {
      const host = this.hostParams();
      if (host) {
        this.bindParams(host);
      }
    });

    effect(() => {
      this.items();
      this.loading();
      queueMicrotask(() => this.syncDetailHeight());
    });
  }

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    this.bindParams(params);
    return true;
  }

  private bindParams(params: Params): void {
    this.gridParams = params;
    this.onDetailHeight = params.onDetailHeight ?? (() => {});
    const data = params.data;
    const meta = data ? detailMeta(data) : null;
    if (!meta) {
      this.loading.set(false);
      return;
    }

    if (meta.loadId !== this.loadId()) {
      this.loadId.set(meta.loadId);
      this.detailParentId = meta.detailParentId;
      this.fetchItems(meta.loadId);
    } else {
      this.detailParentId = meta.detailParentId;
      queueMicrotask(() => this.syncDetailHeight());
    }
  }

  protected onItemsGridReady(_event: GridReadyEvent<ItemRow>): void {
    this.syncDetailHeight();
  }

  protected onItemsFirstDataRendered(_event?: FirstDataRenderedEvent<ItemRow>): void {
    this.syncDetailHeight();
  }

  private fetchItems(loadId: number): void {
    const generation = ++this.fetchGeneration;
    this.loading.set(true);
    this.error.set(null);
    this.items.set([]);
    this.truncated.set(false);
    this.total.set(0);

    const params = new HttpParams()
      .set('load_id', String(loadId))
      .set('page', '1')
      .set('per_page', String(ITEMS_PER_PAGE))
      .set('sort', 'good_type')
      .set('direction', 'asc');

    this.http
      .get<ItemsListResponse>('/api/items', { params })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (generation !== this.fetchGeneration) {
          return;
        }
        this.loading.set(false);
        if (!res) {
          this.error.set('Unable to load items.');
          return;
        }
        this.items.set(res.items);
        this.total.set(res.meta.total);
        this.truncated.set(res.meta.total > res.items.length);
        queueMicrotask(() => this.syncDetailHeight());
      });
  }

  private syncDetailHeight(): void {
    const params = this.gridParams;
    const panel = this.panelRef()?.nativeElement;
    if (!params || !panel) {
      return;
    }

    const height = Math.ceil(panel.getBoundingClientRect().height);
    if (height <= 0) {
      return;
    }

    params.node.setRowHeight(height);
    this.onDetailHeight(this.detailParentId, height);
    params.api.onRowHeightChanged();
  }
}

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

export interface CompanyActionItem {
  id: string;
  label: string;
  run: () => void;
}

export interface CompanyActionsCellParams {
  actionsFor: (data: CompanyActionsCellRow) => CompanyActionItem[];
}

export interface CompanyActionsCellRow {
  id: number;
  business_name: string;
}

type Params = ICellRendererParams<CompanyActionsCellRow> & CompanyActionsCellParams;

@Component({
  selector: 'app-network-actions-cell',
  templateUrl: './network-actions-cell.html',
  styleUrl: './network-actions-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkActionsCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly actions = signal<CompanyActionItem[]>([]);
  protected readonly menuOpen = signal(false);

  agInit(params: Params): void {
    this.refresh(params);
  }

  refresh(params: Params): boolean {
    const data = params.data;
    this.actions.set(data ? (params.actionsFor?.(data) ?? []) : []);
    this.menuOpen.set(false);
    this.cdr.markForCheck();
    return true;
  }

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected runAction(action: CompanyActionItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen.set(false);
    action.run();
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.cdr.markForCheck();
    }
  }
}

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

export interface VehicleCategoryActionItem {
  id: string;
  label: string;
  danger?: boolean;
  run: () => void;
}

export interface VehicleCategoryActionsCellParams {
  actionsFor: (data: VehicleCategoryActionsCellRow) => VehicleCategoryActionItem[];
}

export interface VehicleCategoryActionsCellRow {
  id: number;
  name: string;
}

type Params = ICellRendererParams<VehicleCategoryActionsCellRow> & VehicleCategoryActionsCellParams;

@Component({
  selector: 'app-vehicle-category-actions-cell',
  templateUrl: './vehicle-category-actions-cell.html',
  styleUrl: './vehicle-category-actions-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleCategoryActionsCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly actions = signal<VehicleCategoryActionItem[]>([]);
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

  protected runAction(action: VehicleCategoryActionItem, event: Event): void {
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

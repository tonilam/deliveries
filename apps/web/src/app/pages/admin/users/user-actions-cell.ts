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

export interface UserActionItem {
  id: string;
  label: string;
  run: () => void;
}

export interface UserActionsCellParams {
  actionsFor: (data: UserActionsCellRow) => UserActionItem[];
}

export interface UserActionsCellRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  has_password: boolean;
}

type Params = ICellRendererParams<UserActionsCellRow> & UserActionsCellParams;

@Component({
  selector: 'app-user-actions-cell',
  templateUrl: './user-actions-cell.html',
  styleUrl: './user-actions-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserActionsCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly actions = signal<UserActionItem[]>([]);
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

  protected runAction(action: UserActionItem, event: Event): void {
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

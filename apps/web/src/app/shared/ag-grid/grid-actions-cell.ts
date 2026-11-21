import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

export interface GridActionItem {
  id: string;
  label: string;
  run: () => void;
  danger?: boolean;
}

export interface GridActionsCellParams<T = unknown> {
  actionsFor: (data: T) => GridActionItem[];
}

type Params<T = unknown> = ICellRendererParams<T> & GridActionsCellParams<T>;

const MENU_MIN_WIDTH_PX = 168;

let closeActiveMenu: (() => void) | null = null;

@Component({
  selector: 'app-grid-actions-cell',
  templateUrl: './grid-actions-cell.html',
  styleUrl: './grid-actions-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridActionsCell<T = unknown> implements ICellRendererAngularComp, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private params!: Params<T>;
  private readonly closeFromRegistry = (): void => this.closeMenu();
  private triggerElement: HTMLButtonElement | null = null;
  private menuElement: HTMLDivElement | null = null;
  private anchorTriggerTop = 0;
  private anchorTriggerLeft = 0;
  private scrollFrame = 0;
  private readonly onAnyScroll = (): void => {
    if (this.scrollFrame !== 0) {
      return;
    }
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.followTrigger();
    });
  };

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Node)) {
      this.closeMenu();
      return;
    }
    if (this.triggerElement?.contains(target) || this.menuElement?.contains(target)) {
      return;
    }
    this.closeMenu();
  };

  protected readonly actions = signal<GridActionItem[]>([]);
  protected readonly menuOpen = signal(false);

  agInit(params: Params<T>): void {
    this.refresh(params);
  }

  refresh(params: Params<T>): boolean {
    this.params = params;
    const data = params.data;
    this.actions.set(data ? (params.actionsFor?.(data) ?? []) : []);
    this.cdr.markForCheck();
    return true;
  }

  ngOnDestroy(): void {
    this.closeMenu();
  }

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (event.currentTarget instanceof HTMLButtonElement) {
      this.triggerElement = event.currentTarget;
    }
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  protected runAction(action: GridActionItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeMenu();
    action.run();
  }

  private openMenu(): void {
    closeActiveMenu?.();
    const actions = this.actions();
    if (actions.length === 0 || !this.triggerElement) {
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'grid-actions-portal';
    menu.setAttribute('role', 'menu');

    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = action.danger
        ? 'grid-actions-portal__item grid-actions-portal__item--danger'
        : 'grid-actions-portal__item';
      button.setAttribute('role', 'menuitem');
      button.textContent = action.label;
      button.addEventListener('mousedown', (mouseEvent) => {
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        this.closeMenu();
        action.run();
      });
      menu.appendChild(button);
    }

    document.body.appendChild(menu);
    this.menuElement = menu;
    closeActiveMenu = this.closeFromRegistry;
    this.menuOpen.set(true);
    this.placeMenu();
    this.cdr.markForCheck();
    document.addEventListener('scroll', this.onAnyScroll, true);
    setTimeout(() => document.addEventListener('click', this.onDocumentClick), 0);
  }

  private closeMenu(): void {
    if (closeActiveMenu === this.closeFromRegistry) {
      closeActiveMenu = null;
    }
    document.removeEventListener('scroll', this.onAnyScroll, true);
    document.removeEventListener('click', this.onDocumentClick);
    if (this.scrollFrame !== 0) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = 0;
    }
    this.menuElement?.remove();
    this.menuElement = null;
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.cdr.markForCheck();
    }
  }

  private placeMenu(): void {
    const trigger = this.triggerElement;
    const menu = this.menuElement;
    if (!trigger || !menu) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    this.anchorTriggerTop = rect.top;
    this.anchorTriggerLeft = rect.left;
    const width = Math.max(rect.width, MENU_MIN_WIDTH_PX);
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    menu.style.minWidth = `${width}px`;
    menu.style.transform = 'translate(0px, 0px)';
    menu.style.left = `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`;

    const height = menu.offsetHeight;
    const below = rect.bottom + 4;
    const top = below + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : below;
    menu.style.top = `${top}px`;
  }

  private followTrigger(): void {
    const trigger = this.triggerElement;
    const menu = this.menuElement;
    if (!trigger || !menu) {
      return;
    }
    if (!trigger.isConnected) {
      this.closeMenu();
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const deltaX = rect.left - this.anchorTriggerLeft;
    const deltaY = rect.top - this.anchorTriggerTop;
    menu.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  }
}

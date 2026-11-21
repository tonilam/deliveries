import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastrService } from './toastr.service';

@Component({
  selector: 'app-toastr-host',
  imports: [],
  template: `
    <div class="toastr-host" aria-live="polite" aria-atomic="false">
      @for (toast of toastr.messages(); track toast.id) {
        <div
          class="toastr-host__item"
          [class.toastr-host__item--success]="toast.variant === 'success'"
          [class.toastr-host__item--error]="toast.variant === 'error'"
          [class.toastr-host__item--info]="toast.variant === 'info'"
          [class.toastr-host__item--warning]="toast.variant === 'warning'"
          role="status"
        >
          <span class="toastr-host__text">{{ toast.message }}</span>
          <button
            type="button"
            class="toastr-host__close"
            [attr.aria-label]="'Dismiss notification'"
            (click)="toastr.dismiss(toast.id)"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toastr-host {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: min(24rem, calc(100vw - 2rem));
      pointer-events: none;
    }

    .toastr-host__item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #e2e8f0;
      background: #fff;
      box-shadow: 0 10px 15px -3px rgb(15 23 42 / 0.1);
      font-size: 0.875rem;
      line-height: 1.4;
      color: var(--ui-color-text-primary);
      pointer-events: auto;
    }

    .toastr-host__item--success {
      border-left: 4px solid var(--ui-color-success);
    }

    .toastr-host__item--error {
      border-left: 4px solid var(--ui-color-error);
    }

    .toastr-host__item--info {
      border-left: 4px solid var(--ui-color-info);
    }

    .toastr-host__item--warning {
      border-left: 4px solid var(--ui-color-warning);
    }

    .toastr-host__text {
      flex: 1;
    }

    .toastr-host__close {
      flex-shrink: 0;
      border: 0;
      background: transparent;
      color: #64748b;
      font-size: 1.25rem;
      line-height: 1;
      padding: 0;
      cursor: pointer;
    }

    .toastr-host__close:hover {
      color: var(--ui-color-text-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastrHost {
  protected readonly toastr = inject(ToastrService);
}

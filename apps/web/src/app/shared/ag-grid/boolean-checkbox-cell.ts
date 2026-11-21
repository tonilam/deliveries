import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-boolean-checkbox-cell',
  template: `
    <label class="boolean-checkbox-cell">
      <input type="checkbox" [checked]="checked()" disabled aria-label="Active" />
    </label>
  `,
  styles: [
    `
      .boolean-checkbox-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        margin: 0;
        cursor: default;
      }

      .boolean-checkbox-cell input {
        width: 1rem;
        height: 1rem;
        margin: 0;
        pointer-events: none;
        accent-color: var(--ui-color-brand, #f05a28);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BooleanCheckboxCell implements ICellRendererAngularComp {
  protected readonly checked = signal(false);

  agInit(params: ICellRendererParams): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.checked.set(Boolean(params.value));
    return true;
  }
}

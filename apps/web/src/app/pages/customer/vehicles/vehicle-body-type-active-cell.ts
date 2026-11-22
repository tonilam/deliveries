import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { CustomerVehicleBodyTypeRow } from './vehicles';

export interface VehicleBodyTypeActiveCellParams {
  onToggle: (row: CustomerVehicleBodyTypeRow, active: boolean) => void;
}

type Params = ICellRendererParams<CustomerVehicleBodyTypeRow> & VehicleBodyTypeActiveCellParams;

@Component({
  selector: 'app-vehicle-body-type-active-cell',
  templateUrl: './vehicle-body-type-active-cell.html',
  styleUrl: './vehicle-body-type-active-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleBodyTypeActiveCell implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private params!: Params;

  protected row: CustomerVehicleBodyTypeRow | undefined;

  agInit(params: Params): void {
    this.params = params;
    this.refreshFromParams();
  }

  refresh(params: Params): boolean {
    this.params = params;
    this.refreshFromParams();
    return true;
  }

  protected onChange(event: Event): void {
    event.stopPropagation();
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !this.row) {
      return;
    }
    this.params.onToggle(this.row, input.checked);
  }

  private refreshFromParams(): void {
    this.row = this.params.data;
    this.cdr.markForCheck();
  }
}

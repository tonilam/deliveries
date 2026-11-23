import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { VehicleActivityPanel } from './vehicle-activity-panel';

@Component({
  selector: 'app-vehicle-activity-slider',
  imports: [VehicleActivityPanel],
  templateUrl: './vehicle-activity-slider.html',
  styleUrls: ['../deliveries/load-items-slider.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleActivitySlider {
  readonly closed = output<void>();

  protected close(): void {
    this.closed.emit();
  }
}

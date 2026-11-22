import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { LoadActivityPanel } from './load-activity-panel';
import { LoadRow } from './load.types';

@Component({
  selector: 'app-load-activity-slider',
  imports: [LoadActivityPanel],
  templateUrl: './load-activity-slider.html',
  styleUrls: ['./load-items-slider.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadActivitySlider {
  readonly load = input.required<LoadRow>();

  readonly closed = output<void>();

  protected close(): void {
    this.closed.emit();
  }
}

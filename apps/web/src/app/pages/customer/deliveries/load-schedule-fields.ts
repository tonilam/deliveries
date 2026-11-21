import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { UiDatePickerComponent } from '../../../shared/ui/date-picker/date-picker';
import { UiTimePickerComponent } from '../../../shared/ui/time-picker/time-picker';

@Component({
  selector: 'app-load-schedule-fields',
  imports: [ReactiveFormsModule, UiDatePickerComponent, UiTimePickerComponent],
  templateUrl: './load-schedule-fields.html',
  styleUrl: './load-schedule-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadScheduleFields {
  readonly form = input.required<FormGroup>();
}

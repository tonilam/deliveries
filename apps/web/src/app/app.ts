import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastrHost } from './core/feedback/toastr-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastrHost],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App {}

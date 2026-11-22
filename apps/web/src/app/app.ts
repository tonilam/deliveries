import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SessionMonitor } from './core/auth/session-monitor';
import { ToastrHost } from './core/feedback/toastr-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastrHost],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App {
  /** Starts periodic session checks while a user is signed in. */
  private readonly _sessionMonitor = inject(SessionMonitor);
}

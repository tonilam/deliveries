import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly title = signal('Loadplanner');
  protected readonly healthStatus = signal<'idle' | 'ok' | 'error'>('idle');
  protected readonly healthMessage = signal('Checking API…');

  ngOnInit(): void {
    this.http.get<{ status: string; database: string }>('/api/health').subscribe({
      next: (res) => {
        this.healthStatus.set('ok');
        this.healthMessage.set(`API ${res.status} · database ${res.database}`);
      },
      error: () => {
        this.healthStatus.set('error');
        this.healthMessage.set('API unreachable — start Laravel on :8000');
      },
    });
  }
}

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Chart, type ChartConfiguration } from 'chart.js/auto';
import { catchError, of } from 'rxjs';

import { DashboardApiService } from '../../../core/dashboard/dashboard-api.service';

export interface CounterpartyRank {
  company_id: number;
  business_name: string;
  load_count: number;
}

export interface CustomerDashboardResponse {
  company_type: 'customer' | 'provider' | 'broker';
  top_customers: CounterpartyRank[];
  top_providers: CounterpartyRank[];
  loads_by_date: { pickup_date: string; count: number }[];
}

@Component({
  selector: 'app-customer-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['../../../shared/portal-shell.scss', './dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDashboard implements OnDestroy {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly weekChartRef = viewChild<ElementRef<HTMLCanvasElement>>('weekChart');
  private chart: Chart<'line'> | null = null;
  private lastChartSignature: string | null = null;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly dashboard = signal<CustomerDashboardResponse | null>(null);

  protected readonly showCustomers = (data: CustomerDashboardResponse): boolean =>
    data.company_type === 'provider' || data.company_type === 'broker';

  protected readonly showProviders = (data: CustomerDashboardResponse): boolean =>
    data.company_type === 'customer' || data.company_type === 'broker';

  constructor() {
    effect(() => {
      const canvas = this.weekChartRef()?.nativeElement;
      const data = this.dashboard();
      if (!canvas || !data) {
        return;
      }
      const signature = data.loads_by_date
        .map((row) => `${row.pickup_date}:${row.count}`)
        .join('|');
      if (signature === this.lastChartSignature) {
        return;
      }
      this.renderChart(canvas, data);
      this.lastChartSignature = signature;
    });

    this.dashboardApi
      .getCustomerDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        this.loading.set(false);
        if (data === null) {
          this.error.set('Could not load dashboard.');
          this.cdr.markForCheck();
          return;
        }
        this.dashboard.set(data);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private renderChart(canvas: HTMLCanvasElement, data: CustomerDashboardResponse): void {
    this.chart?.destroy();
    this.chart = null;

    const labels = data.loads_by_date.map((row) => this.formatDateLabel(row.pickup_date));
    const counts = data.loads_by_date.map((row) => row.count);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Loads',
            data: counts,
            borderColor: 'rgba(0, 61, 122, 1)',
            backgroundColor: 'rgba(0, 61, 122, 0.12)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(0, 61, 122, 1)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Loads in this week and next week',
            font: { weight: 'bold' },
            color: '#003d7a',
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 14 },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
          },
        },
      },
    };

    this.chart = new Chart(canvas, config);
  }

  private formatDateLabel(pickupDate: string): string {
    const date = new Date(`${pickupDate}T00:00:00Z`);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
}

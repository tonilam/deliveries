import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Chart, type ChartConfiguration } from 'chart.js/auto';
import * as L from 'leaflet';
import { HeatLayer } from 'leaflet.heat';
import { catchError, of } from 'rxjs';

import { DashboardApiService } from '../../../core/dashboard/dashboard-api.service';
import { stateCentroid } from './state-centroids';

export interface AdminDashboardResponse {
  user_count: number;
  company_count: number;
  loads_by_week: { week_start: string; count: number }[];
  state_flows: StateFlow[];
}

export interface StateFlow {
  from_state: string;
  from_country: string;
  to_state: string;
  to_country: string;
  count: number;
}

/** Southwest / northeast corners covering all of Australia and New Zealand (mainland + near islands). */
const AU_NZ_BOUNDS = L.latLngBounds(L.latLng(-47.85, 112.45), L.latLng(-8.65, 179.35));

const AU_NZ_FIT_OPTIONS: L.FitBoundsOptions = {
  padding: [18, 18],
  maxZoom: 5,
};

@Component({
  selector: 'app-admin-home',
  templateUrl: './admin-home.html',
  styleUrls: ['../../../shared/portal-shell.scss', './admin-home.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHome implements OnDestroy {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly loadsChartRef = viewChild<ElementRef<HTMLCanvasElement>>('loadsChart');
  private readonly stateMapRef = viewChild<ElementRef<HTMLDivElement>>('stateMap');

  private chart: Chart<'bar'> | null = null;
  private lastChartSignature: string | null = null;
  private map: L.Map | null = null;
  private heatLayer: (HeatLayer & L.Layer) | null = null;
  private lastHeatSignature: string | null = null;
  private pendingHeatFlows: StateFlow[] | null = null;
  private auNzViewFitted = false;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly dashboard = signal<AdminDashboardResponse | null>(null);
  protected readonly hasStateHeat = signal(false);

  constructor() {
    effect(() => {
      const canvas = this.loadsChartRef()?.nativeElement;
      const data = this.dashboard();
      if (!canvas || !data) {
        return;
      }
      const signature = `${data.loads_by_week.length}:${data.loads_by_week.at(-1)?.week_start ?? ''}`;
      if (signature === this.lastChartSignature) {
        return;
      }
      this.renderChart(canvas, data);
      this.lastChartSignature = signature;
    });

    effect(() => {
      const container = this.stateMapRef()?.nativeElement;
      const data = this.dashboard();
      if (!container || !data) {
        return;
      }
      const signature = this.heatSignature(data.state_flows);
      if (signature === this.lastHeatSignature) {
        return;
      }
      this.pendingHeatFlows = data.state_flows;
      this.lastHeatSignature = signature;
      this.scheduleStateMapRender(container);
    });

    afterNextRender(() => {
      const container = this.stateMapRef()?.nativeElement;
      if (container && this.pendingHeatFlows) {
        this.scheduleStateMapRender(container);
      }
    });

    this.dashboardApi
      .getAdminDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        this.loading.set(false);
        if (data === null) {
          this.error.set('Could not load dashboard.');
          this.cdr.markForCheck();
          return;
        }
        this.dashboard.set(data);
        this.hasStateHeat.set(data.state_flows.length > 0);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.detachHeatLayer();
    this.map?.remove();
    this.map = null;
    this.auNzViewFitted = false;
  }

  private detachHeatLayer(): void {
    if (this.heatLayer && this.map) {
      this.map.removeLayer(this.heatLayer);
    }
    this.heatLayer = null;
  }

  private heatSignature(flows: StateFlow[]): string {
    return flows
      .map((f) => `${f.from_country}${f.from_state}->${f.to_country}${f.to_state}:${f.count}`)
      .join('|');
  }

  private buildHeatPoints(flows: StateFlow[]): [number, number, number][] {
    const byLocation = new Map<string, { lat: number; lng: number; count: number }>();

    const add = (country: string, state: string, count: number): void => {
      const centroid = stateCentroid(country, state);
      if (!centroid) {
        return;
      }
      const key = `${country}:${state}`;
      const existing = byLocation.get(key);
      if (existing) {
        existing.count += count;
      } else {
        byLocation.set(key, { lat: centroid.lat, lng: centroid.lng, count });
      }
    };

    for (const flow of flows) {
      add(flow.from_country, flow.from_state, flow.count);
      add(flow.to_country, flow.to_state, flow.count);
    }

    const peak = Math.max(...[...byLocation.values()].map((row) => row.count), 1);

    return [...byLocation.values()].map(
      (row) => [row.lat, row.lng, row.count / peak] as [number, number, number],
    );
  }

  private scheduleStateMapRender(container: HTMLElement): void {
    const flows = this.pendingHeatFlows;
    if (!flows) {
      return;
    }
    requestAnimationFrame(() => {
      this.renderStateMap(container, flows);
      requestAnimationFrame(() => {
        if (!this.map) {
          return;
        }
        this.map.invalidateSize();
        if (!this.auNzViewFitted) {
          this.fitAustraliaNewZealand();
          this.auNzViewFitted = true;
        }
      });
    });
  }

  private fitAustraliaNewZealand(): void {
    this.map?.fitBounds(AU_NZ_BOUNDS, AU_NZ_FIT_OPTIONS);
  }

  private renderStateMap(container: HTMLElement, flows: StateFlow[]): void {
    const points = this.buildHeatPoints(flows);

    if (!this.map) {
      this.map = L.map(container, {
        scrollWheelZoom: false,
        attributionControl: true,
        maxBounds: AU_NZ_BOUNDS.pad(0.25),
        maxBoundsViscosity: 0.85,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(this.map);
      this.map.setView([-28.5, 146.0], 4);
    }

    this.detachHeatLayer();

    if (points.length > 0) {
      const layer = new HeatLayer(points, {
        radius: 32,
        blur: 26,
        minOpacity: 0.35,
        max: 1,
        maxZoom: 12,
        gradient: {
          0.15: '#dbeafe',
          0.45: '#2563eb',
          0.75: '#ea580c',
          1.0: '#b91c1c',
        },
      }) as HeatLayer & L.Layer;
      this.heatLayer = layer;
      layer.addTo(this.map);
    }
  }

  private renderChart(canvas: HTMLCanvasElement, data: AdminDashboardResponse): void {
    this.chart?.destroy();
    this.chart = null;

    const labels = data.loads_by_week.map((row) => this.formatWeekLabel(row.week_start));
    const counts = data.loads_by_week.map((row) => row.count);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Loads',
            data: counts,
            backgroundColor: 'rgba(0, 61, 122, 0.85)',
            borderRadius: 4,
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
            text: 'Loads by week in last 4 months',
            font: { weight: 'bold' },
            color: '#003d7a',
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 18 },
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

  private formatWeekLabel(weekStart: string): string {
    const date = new Date(`${weekStart}T00:00:00Z`);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}

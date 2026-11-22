import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Mirrors truckit-component-library UiBadgeComponent (demo → Badges & Status). */
export type UiBadgeAppearance = 'filled' | 'transparent' | 'outline';
export type UiBadgeColor = 'brand' | 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'muted';
export type UiBadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-badge',
  template: `
    <span [class]="classes()">
      @if (showDot()) {
        <span class="ui-badge__dot" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiBadgeComponent {
  readonly appearance = input<UiBadgeAppearance>('filled');
  readonly color = input<UiBadgeColor>('brand');
  readonly size = input<UiBadgeSize>('md');
  readonly showDot = input(false);

  protected readonly classes = computed(() => {
    const parts = [
      'ui-badge',
      `ui-badge--${this.appearance()}`,
      `ui-badge--${this.color()}`,
      `ui-badge--${this.size()}`,
    ];
    if (this.showDot()) {
      parts.push('ui-badge--with-dot');
    }
    return parts.join(' ');
  });
}

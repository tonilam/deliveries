import type { UiBadgeColor, UiBadgeSize } from '../../../shared/ui/badge/badge';
import { LoadRow } from './load.types';

export type DirectLoadKindLabel = 'Direct' | 'Add Drop' | 'X Dock' | 'Hybrid';

export const LOAD_KIND_FILTER_OPTIONS = [
  { slug: 'direct', label: 'Direct' },
  { slug: 'add_drop', label: 'Add Drop' },
  { slug: 'x_dock', label: 'X Dock' },
  { slug: 'hybrid', label: 'Hybrid' },
] as const;

export type LoadKindFilterSlug = (typeof LOAD_KIND_FILTER_OPTIONS)[number]['slug'];

export const LOAD_KIND_FILTER_LABELS = LOAD_KIND_FILTER_OPTIONS.map(
  (option) => option.label,
) as DirectLoadKindLabel[];

const LABEL_TO_SLUG = Object.fromEntries(
  LOAD_KIND_FILTER_OPTIONS.map((option) => [option.label, option.slug]),
) as Record<DirectLoadKindLabel, LoadKindFilterSlug>;

/** Parent direct load composition shown in the deliveries list. */
export function directLoadKind(load: LoadRow): DirectLoadKindLabel {
  const children = load.children ?? [];
  if (children.length === 0) {
    return 'Direct';
  }

  const hasAddDrop = children.some((child) => child.type === 'add_drop');
  const hasXDock = children.some((child) => child.type === 'x_dock');

  if (hasAddDrop && hasXDock) {
    return 'Hybrid';
  }
  if (hasAddDrop) {
    return 'Add Drop';
  }
  if (hasXDock) {
    return 'X Dock';
  }
  return 'Direct';
}

export function loadKindLabelToSlug(label: DirectLoadKindLabel): LoadKindFilterSlug {
  return LABEL_TO_SLUG[label];
}

/** Truckit demo “In Transit” filled badge (grey pill border). */
export const DIRECT_LOAD_KIND_BADGE_COLOR: UiBadgeColor = 'info';
export const DIRECT_LOAD_KIND_BADGE_SIZE: UiBadgeSize = 'sm';

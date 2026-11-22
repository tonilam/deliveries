import type { UiBadgeColor, UiBadgeSize } from '../ui/badge/badge';

export interface DataListColumn<T> {
  field: keyof T & string;
  label: string;
  labelFor?: (row: T) => string;
  valueFor?: (row: T) => string;
  /** Primary cell is only a badge (no text line above). */
  badgeValueFor?: (row: T) => string | null | undefined;
  /** Optional badge under the primary value. */
  subValueFor?: (row: T) => string | null | undefined;
  subValueBadgeColor?: UiBadgeColor;
  subValueBadgeSize?: UiBadgeSize;
  /** When true, compact list shows a read-only checkbox instead of text. */
  booleanCheckbox?: boolean;
}

export interface DataListSortOption {
  field: string;
  label: string;
}

export interface DataListAction<T> {
  id: string;
  label: string;
  variant?: 'primary' | 'ghost' | 'danger';
  run: (row: T) => void;
}

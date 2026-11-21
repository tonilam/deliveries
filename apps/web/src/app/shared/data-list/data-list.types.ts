export interface DataListColumn<T> {
  field: keyof T & string;
  label: string;
  labelFor?: (row: T) => string;
  valueFor?: (row: T) => string;
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

export interface DataListColumn<T> {
  field: keyof T & string;
  label: string;
  valueFor?: (row: T) => string;
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

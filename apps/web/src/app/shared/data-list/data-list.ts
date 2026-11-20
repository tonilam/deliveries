import { ChangeDetectionStrategy, Component, OnDestroy, input, output } from '@angular/core';

import { DataListAction, DataListColumn, DataListSortOption } from './data-list.types';

const MAX_ACTIONS = 3;

@Component({
  selector: 'app-data-list',
  imports: [],
  templateUrl: './data-list.html',
  styleUrl: './data-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataListComponent<T extends { id: number | string }> implements OnDestroy {
  readonly loading = input(false);
  readonly rows = input<T[]>([]);
  readonly titleFor = input.required<(row: T) => string>();
  readonly columns = input.required<DataListColumn<T>[]>();
  readonly actionsFor = input.required<(row: T) => DataListAction<T>[]>();
  readonly searchValue = input('');
  readonly searchPlaceholder = input('Search…');
  readonly sortOptions = input.required<DataListSortOption[]>();
  readonly sortField = input.required<string>();
  readonly sortDirection = input.required<'asc' | 'desc'>();

  readonly searchChange = output<string>();
  readonly sortFieldChange = output<string>();
  readonly sortDirectionChange = output<'asc' | 'desc'>();

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  protected trackRow(row: T): string | number {
    return row.id;
  }

  protected valueFor(column: DataListColumn<T>, row: T): string {
    if (column.valueFor) {
      return column.valueFor(row);
    }
    const value = row[column.field];
    if (value == null) {
      return '';
    }
    return String(value);
  }

  protected visibleActions(row: T): DataListAction<T>[] {
    return this.actionsFor()(row).slice(0, MAX_ACTIONS);
  }

  protected runAction(action: DataListAction<T>, row: T): void {
    action.run(row);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchDebounce !== null) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.searchChange.emit(value);
      this.searchDebounce = null;
    }, 300);
  }

  protected onSortFieldSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.sortFieldChange.emit(value);
  }

  protected toggleSortDirection(): void {
    const next = this.sortDirection() === 'asc' ? 'desc' : 'asc';
    this.sortDirectionChange.emit(next);
  }

  ngOnDestroy(): void {
    if (this.searchDebounce !== null) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
  }
}

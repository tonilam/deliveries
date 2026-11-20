---
name: table-responsive
description: >-
  Renders AG Grid list pages on desktop and a compact data list on viewports
  720px or narrower, with server search, sort, and up to three row actions.
  Use when building or changing AG Grid list pages (Addresses, Users, Companies),
  mobile layouts for tables, or responsive data lists.
---

# Table responsive (AG Grid → data list)

## Rules

1. **Breakpoint:** `max-width: 720px` (same as app shell). Use [`compact-viewport.ts`](../../apps/web/src/app/shared/compact-viewport.ts) (`COMPACT_MAX_WIDTH_PX`). Do not mount AG Grid and hide it with CSS on small screens — render one view or the other.
2. **Desktop (`> 720px`):** keep existing AG Grid (column filters, sort, actions).
3. **Compact (`≤ 720px`):** use **`app-data-list`** instead of AG Grid ([`data-list/`](../../apps/web/src/app/shared/data-list/)).
4. **List item:**
   - **Title** — one primary field (e.g. business name).
   - **Body** — each other column on its own line: `Label` + value.
   - **Footer** — up to **3** action buttons (not a dropdown). Enforce with `.slice(0, 3)`.
5. **Toolbar (compact only):**
   - **Search** — single field, debounced (~300ms), server-side across all list columns; resets to page 1.
   - **Sort by** — column dropdown + asc/desc; same `sort` / `direction` query params as the grid.
6. **Pagination** — keep the existing footer (summary, page size, prev/next) for both viewports.
7. **Query separation:** On compact, send `search` and omit AG Grid column `filter` params. On desktop, send column filters and omit `search`. Sort and pagination params are shared.
8. **Viewport transitions:** When `compact()` changes, clear the inactive mode’s state (`filterModel` when entering compact, `searchQuery` when entering desktop), reset to page 1, and reload. On desktop `gridReady`, restore `filterModel` and column sort from the parent (`applyColumnState` / `setFilterModel` with `suppressGridEvents`).

## Wiring a page

1. Import `createCompactViewportSignal` and call it in the page component (destroy ref on cleanup).
2. Define `DataListColumn<T>`, `DataListSortOption`, and `DataListAction<T>` for the entity.
3. Add compact-only state: `searchQuery` signal, handlers for search/sort that update server params and `load$`.
4. Extend `buildParams()`: if `compact()`, append `search` when non-empty; else existing filter model logic.
5. Template:

```html
@if (compact()) {
  <app-data-list
    [loading]="loading()"
    [rows]="rows()"
    [titleFor]="titleFn"
    [columns]="listColumns"
    [actionsFor]="actionsForList"
    [searchValue]="searchQuery()"
    searchPlaceholder="Search addresses…"
    [sortOptions]="sortOptions"
    [sortField]="sortField"
    [sortDirection]="sortDirection"
    (searchChange)="onListSearch($event)"
    (sortFieldChange)="onListSortField($event)"
    (sortDirectionChange)="onListSortDirection($event)"
  />
} @else {
  <ag-grid-angular ... />
}
```

6. Reference implementation: [`addresses.ts`](../../apps/web/src/app/pages/customer/addresses/addresses.ts).

## API

When compact search is server-paginated, add optional validated `search` on the list endpoint and `OR` contains across displayed columns (and type display labels where applicable). See Addresses: `ListAddressesRequest` + `AddressListController::applySearch`.

## Do not

- Copy-paste a new list markup per page — extend `app-data-list`.
- Add `truckit-component-library` solely for this pattern (app uses tokens + existing `.btn` until the library is installed project-wide).
- Show more than three action buttons on a list item.

## Pages using this pattern

- Customer addresses — `apps/web/src/app/pages/customer/addresses/`
- Admin users — `apps/web/src/app/pages/admin/users/` (per-tab columns; `search` on `GET /api/admin/users`)
- Admin companies — `apps/web/src/app/pages/admin/companies/` (`search` on `GET /api/admin/companies`)
# 2026-11-21 — Admin company list pagination

- Updated [US-013](../stories/US-013-admin-company-management.md): Companies list is server-paginated and server-filtered.
- API `GET /api/admin/companies` accepts `page` / `per_page` (default 25; allowed 10, 25, 50, 100, 200) and optional column `filter` params; returns pagination `meta` for the filtered set.
- Web Companies page shows range/total, page size selector, and previous/next controls; grid uses auto height so the full current page is visible (no fixed-height inner scroll).
- AG Grid column/floating filters remain in the UI; matching is applied on the server (client `textMatcher` always passes).
- Updated [US-007](../stories/US-007-admin-create-and-invite-users.md): create-user company picker is a debounced autocomplete (min 2 characters, business-name starts-with) against the list API; ↑/↓/Enter/Esc keyboard selection; locked `company_id` from Companies still loads by id.

# 2026-11-21 — Admin user list pagination, filtering, and sorting

- Updated [US-003](../stories/US-003-admin-user-management-lists.md): User management lists are server-paginated, server-filtered, and server-sorted (same behaviour as companies).
- API `GET /api/admin/users` accepts `page` / `per_page` (default 25; allowed 10, 25, 50, 100, 200), optional `sort` / `direction` (`name`, `email`, `is_active`, and for customers `company`; defaults `name` / `asc`), and optional column `filter` params; returns pagination `meta` for the filtered set. `role` remains required.
- Web User management page loads the active tab only, shows range/total, page size selector, and previous/next; grid uses auto height. Switching tabs resets to page 1 with default sort.

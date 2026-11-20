# 2026-11-20 — Admin user management lists

- Added [US-003](../stories/US-003-admin-user-management-lists.md): admin User Management shows Admin / Customer tabs with AG Grid tables (name, email, active).
- API: `GET /api/admin/users?role=admin|customer` (admin-only) returns matching users.
- Web: installed `ag-grid-angular`; replaced the `/admin/users` placeholder with tabbed lists.
- Customer users tab adds a **Company** column (business name) after **Name**; list API includes `company` on each row.

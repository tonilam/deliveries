# 2026-11-21 — Admin company list sorting

- Updated [US-013](../stories/US-013-admin-company-management.md): Companies list supports server-side column sorting.
- API `GET /api/admin/companies` accepts optional `sort` / `direction` (`business_name`, `reg_number`, `email`, `allowed_domains`; `asc`|`desc`; defaults `business_name` / `asc`).
- Web Companies AG Grid enables single-column sorting; sort changes reset to page 1 and refetch the sorted page from the server.

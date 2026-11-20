# Admin user management lists

## Story
As an admin user, I want to see both an admin user list and a customer user list on the user management page, so that I can review who has access and whether their accounts are active.

## Acceptance criteria
- [x] User management (`/admin/users`) has two tabs: **Admin users** and **Customer users**
- [x] Admin users tab shows a table (AG Grid) with columns: **Name**, **Email**, **Active**
- [x] Customer users tab shows a table (AG Grid) with columns: **Name**, **Company**, **Email**, **Active** (Company is the user’s company business name, after Name)
- [x] Admin tab lists users with `role=admin`; Customer tab lists users with `role=customer`
- [x] Data is loaded from an admin-only API (`GET /api/admin/users?role=admin|customer`); customer list rows include company business name
- [x] The active tab’s list is **server-paginated**: default page size **25**; page size options **10**, **25**, **50**, **100**, **200**; UI shows range + total and lets the admin change page and page size; the grid grows to show all rows on the current page (no fixed viewport height / inner scroll)
- [x] Column filters stay available in the AG Grid UI for **Name**, **Email**, **Active**, and (customer tab) **Company**; filtering is applied **server-side** (with pagination totals reflecting the filtered set)
- [x] Column sorting is available in the AG Grid UI for those same columns; sorting is applied **server-side** (single column; default **Name** ascending)
- [x] List API accepts required `role`, plus `page`, `per_page` (allowed sizes above; default 25), optional `sort` / `direction` (sortable columns above; `asc`|`desc`; defaults `name` / `asc`), and optional column `filter` params, and returns the current page of users plus pagination meta
- [x] Customers cannot access the users API; unauthenticated requests are rejected
- [x] `ag-grid-angular` is installed and used for both tables

## Notes
- Extends the User Management placeholder from [US-002](US-002-admin-portal-and-roles.md); create/invite is [US-007](US-007-admin-create-and-invite-users.md); password reset is [US-008](US-008-admin-reset-user-password.md); impersonate customer is [US-009](US-009-admin-impersonate-customer.md); edit/deactivate still out of scope.
- Company on the customer list comes from [US-012](US-012-user-belongs-to-company.md); admin users do not belong to a company.
- List behaviour matches companies ([US-013](US-013-admin-company-management.md)): server-side pagination, filtering, and sorting.
- Prefer Truckit `UiTabs` / Data Grid wrappers when CodeArtifact access is available; until then use AG Grid Community directly with a local tab control styled with `--ui-*` tokens.

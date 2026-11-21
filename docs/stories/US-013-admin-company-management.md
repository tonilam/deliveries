# Admin company management

## Story
As an admin user, I want to manage companies (list, create, edit) and attach customer users to them, so that customers are organised under the right business and can only join via an allowed email domain.

## Acceptance criteria
- [x] Admin portal has a **Companies** page (`/admin/companies`) linked from admin nav
- [x] Companies are listed in an AG Grid table with columns: **Business name**, **Company type**, **Parent**, **Reg number**, **Email**, **Allowed domains**; on compact viewports (**720px** or narrower) in a **data list** (business name as title, other columns as labeled lines, **Edit** and **Add customer** actions) with **search** and **sort by**
- [x] The companies list is **server-paginated**: default page size **25**; page size options **10**, **25**, **50**, **100**, **200**; UI shows range + total and lets the admin change page and page size; the grid grows to show all rows on the current page (no fixed viewport height / inner scroll)
- [x] Column filters stay available in the AG Grid UI for **Business name**, **Reg number**, **Email**, and **Allowed domains**; filtering is applied **server-side** (with pagination totals reflecting the filtered set)
- [x] Column sorting is available in the AG Grid UI for **Business name**, **Reg number**, **Email**, and **Allowed domains**; sorting is applied **server-side** (single column; default **Business name** ascending)
- [x] List API (`GET /api/admin/companies`) accepts `page`, `per_page` (allowed sizes above; default 25), optional `sort` / `direction` (sortable columns above; `asc`|`desc`; defaults `business_name` / `asc`), and optional column `filter` params, and returns the current page of companies plus pagination meta
- [x] List API accepts optional `search` (contains match across business name, reg number, email, and allowed domains)
- [x] A **Create company** button opens a create flow for company identity/contact fields from [US-011](US-011-company-entity.md), including required **country**, plus **allowed domains** (finance fields are set on edit — [US-014](US-014-admin-company-finance-details.md))
- [x] After successful create, the admin is redirected to that company’s **edit** page
- [x] Each row has an **Edit** action; edit has **Details** and **Finance** tabs ([US-014](US-014-admin-company-finance-details.md)); root companies also have a **Network** tab ([US-021](US-021-admin-company-network.md))
- [x] On **Details** edit, **country** can be changed only while the company has **no addresses**; when addresses exist the country control is disabled and the API rejects country changes
- [x] Saving create or **Details** edit opens a **confirmation modal** that shows **country**, **business name**, **reg number**, and **allowed domains** for the admin to review before the save is submitted
- [x] When the confirmation modal opens, it automatically calls an admin uniqueness-check API; while checking, a **spinner** is shown; each field then shows a **green check** if unique or a **red cross** if conflicting, and conflicting results ask the admin to review the data
- [x] Confirm save is only enabled when all checked fields pass
- [x] **Business name**, **reg number**, and each **allowed domain** must be unique across companies (no duplicates in the system); duplicates are rejected
- [x] Each company has an **Add customer** action that opens Create user with role=customer and that company preselected ([US-007](US-007-admin-create-and-invite-users.md))
- [x] Company has an **allowed domains** list (email domains, e.g. `acme.com`); a given domain may belong to at most one company
- [x] A customer may only be created, invited, or self-registered into a company when their email domain is on that company’s allowed domains list — **including when an admin creates or invites** (no override)
- [x] Public registration auto-assigns the matching company when exactly one company matches; if multiple match, the user must choose which company to join
- [x] Admin-only APIs for list/create/update company; customers and guests are rejected

## Notes
- Builds on [US-011](US-011-company-entity.md) and [US-012](US-012-user-belongs-to-company.md); admin users still never belong to a company.
- Finance details on edit: [US-014](US-014-admin-company-finance-details.md).
- Product intent today is one domain → one company; multi-match choice remains supported if data ever allows it.
- Company pickers (e.g. create user) use a debounced autocomplete (min 2 characters, business-name starts-with) against the companies list API filters.
- Out of scope: delete company, deactivate company, bulk import.

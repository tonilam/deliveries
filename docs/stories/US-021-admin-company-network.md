# Admin company network

## Story
As an admin user, I want to manage a root company’s network from the company edit page, so that I can attach existing customers and providers without asking them to use the customer Network UI.

## Acceptance criteria
- [x] On **edit** of a **root** company (`parent_company_id` null), the edit page has a **Network** tab beside Details and Finance; create flow and linked companies do not show this tab
- [x] **Broker** roots: **Customers** and **Providers** sub-tabs; **Customer** roots: providers list only; **Provider** roots: customers list only
- [x] Each list shows companies where `parent_company_id` is the edited company and `company_type` matches the list; same list pattern as customer Network (AG Grid / data list ≤720px, server pagination, search, sort, filters); columns **Business name**, **Reg number**, **Email**, **Allowed domains**; no row actions
- [x] **Add existing customer** / **Add existing provider** opens a search modal; selecting a company links it by setting `parent_company_id` (company type unchanged)
- [x] Eligible link targets: `parent_company_id` null, matching type, **no child companies**, not the parent being edited
- [x] `GET /api/admin/companies/{company}/network`, `GET …/network/candidates`, `POST …/network` — admin only; **422** when parent is not root, tab type is disallowed, or target is ineligible
- [x] Unlink is out of scope; customer Network CRUD unchanged ([US-019](US-019-customer-network.md))

## Notes
- Type rules: [US-020](US-020-admin-company-type.md). Company edit shell: [US-013](US-013-admin-company-management.md).
# Customer network

## Story
As a customer user, I want to manage my customer and provider network, so that the businesses I trade with are linked under my company.

## Acceptance criteria
- [x] Customer nav includes **Network** at `/app/network` ([US-004](US-004-authenticated-app-shell.md))
- [x] Network page has tabs **Customers** and **Providers**; tabs hidden when the signed-in company’s [company type](US-020-admin-company-type.md) does not allow that side (Customer → Providers only; Provider → Customers only; Broker → both)
- [x] Each tab lists companies where `parent_company_id` is the user’s company and `company_type` matches the tab (`customer` or `provider`)
- [x] List pattern matches admin companies: AG Grid desktop, data list ≤720px; server pagination (default **25**; sizes **10**, **25**, **50**, **100**, **200**); **search**, **sort**, column **filters**
- [x] List columns: **Business name**, **Reg number**, **Email**, **Allowed domains**; row actions **Edit** and **Delete**; **Create** opens a full-page form for the active tab
- [x] Create/edit uses the same identity fields and uniqueness confirmation modal as admin company create ([US-013](US-013-admin-company-management.md)); no finance fields; parent and tab type are set by the API, not editable
- [x] Delete requires confirmation; allowed only when the company has no users, addresses, rate cards, child companies, or rate-card company links; otherwise **422** with a clear message
- [x] `GET/POST /api/network/companies`, `POST /api/network/companies/check-uniqueness`, `GET/PUT/DELETE /api/network/companies/{company}` — authenticated **customer** with a company; others **401/403**; out-of-scope company **404**
- [x] List API returns the caller’s company **company_type** for tab visibility

## Notes
- Entity fields: [US-011](US-011-company-entity.md); type rules: [US-020](US-020-admin-company-type.md).
- Rate card company pickers are limited to this network: [US-018](US-018-customer-rate-cards.md).
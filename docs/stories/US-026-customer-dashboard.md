# Customer dashboard

## Story
As a customer user, I want a dashboard on the customer portal home page, so that I can see my busiest counterparties and how many loads are scheduled this week and next week.

## Acceptance criteria
- [x] Customer **Dashboard** (`/app`) replaces the placeholder with a real dashboard (not a separate route)
- [x] Rankings use loads owned by the signed-in user’s company (`loads.company_id`); only **primary direct** loads count (`type` direct, `parent_load_id` null)—**add/drop and x-dock child loads are excluded**; grouped by counterparty business name; **top 5** by load count (ties broken by business name ascending)
- [x] Owner company type **customer**: show **Top 5 providers** only (`provider_company_id`; no customer ranking section)
- [x] Owner company type **provider**: show **Top 5 customers** only (`customer_company_id`; no provider ranking section)
- [x] Owner company type **broker**: show **both** top-5 lists
- [x] A **line chart** shows primary direct load count **per pickup date** for **this week and next week** combined (UTC: from Monday of the current week through Sunday of the following week); child loads excluded; dates with no loads show **0**
- [x] `GET /api/dashboard` returns the stats; customer with company only (`LoadPolicy::viewAny`); guest **401**; user without company **403**; admin **403**

## Notes
- App shell and nav: [US-004](US-004-authenticated-app-shell.md). Company types: [US-020](US-020-admin-company-type.md). Loads: [US-024](US-024-customer-loads.md).
- Admin dashboard remains [US-025](US-025-admin-dashboard.md) (`GET /api/admin/dashboard`).
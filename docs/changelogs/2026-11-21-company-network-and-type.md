# 2026-11-21 — Company network and type

- Added [US-019](../stories/US-019-customer-network.md): customer **Network** page with Customers/Providers tabs, scoped CRUD on linked companies.
- Added [US-020](../stories/US-020-admin-company-type.md): `company_type` (Customer | Provider | Broker) and `parent_company_id`.
- Updated [US-011](../stories/US-011-company-entity.md), [US-004](../stories/US-004-authenticated-app-shell.md), [US-013](../stories/US-013-admin-company-management.md), [US-018](../stories/US-018-customer-rate-cards.md).
- API: `GET/POST/PUT/DELETE /api/network/companies`, uniqueness check; rate-card company options scoped to network children by `user_type`.
- API: `GET /api/countries` for customer country pickers.
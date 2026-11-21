# 2026-11-21 — Admin company network

- Added [US-021](../stories/US-021-admin-company-network.md): **Network** tab on root company edit; list linked customers/providers; **Add existing** links unparented companies.
- Updated [US-013](../stories/US-013-admin-company-management.md), [US-020](../stories/US-020-admin-company-type.md).
- API: `GET/POST /api/admin/companies/{company}/network`, `GET …/network/candidates`; shared `NetworkCompanyListQuery` for customer and admin network lists.
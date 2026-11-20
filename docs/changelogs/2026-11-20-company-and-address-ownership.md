# 2026-11-20 — Company entity and address ownership

- Added [US-011](../stories/US-011-company-entity.md): `Company` model with reg_number, reg_type, business_name, invoicee_name, phone, email, address.
- Added [US-012](../stories/US-012-user-belongs-to-company.md): users may belong to one company via `company_id`.
- Updated [US-010](../stories/US-010-customer-address-management.md): addresses belong to a company (not a user); customer address APIs scope by the user’s company.
- API: rewired `addresses.company_id`; customers without a company get 403 on address list/create.

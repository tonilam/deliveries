# 2026-11-20 — Customer address management

- Added [US-010](../stories/US-010-customer-address-management.md): customers can list and add collection/delivery addresses.
- Updated [US-004](../stories/US-004-authenticated-app-shell.md) customer nav to include Addresses.
- API: `GET/POST /api/addresses` (customer-only, scoped to the signed-in user) with fields type, business name, address, zone, state, postcode.
- Web: `/app/addresses` AG Grid list and `/app/addresses/create` form.

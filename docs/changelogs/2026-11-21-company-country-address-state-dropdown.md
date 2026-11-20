# 2026-11-21 — Company country and address state dropdown

- Updated [US-011](../stories/US-011-company-entity.md): companies have a required `country_id`.
- Updated [US-013](../stories/US-013-admin-company-management.md): admin create/edit includes country; country is locked once the company has addresses.
- Updated [US-010](../stories/US-010-customer-address-management.md): address create **State** is a dropdown of the company country’s states (stored as state code); `GET /api/addresses/state-options` supplies options.
- Updated [US-015](../stories/US-015-admin-countries-and-states.md): countries are linked from companies; customer state dropdown is in scope.
- Migration backfills existing companies to Australia (`AU`).

# Customer rate cards

## Story
As a customer user, I want to manage my company’s rate cards, so that lane pricing profiles are available for future quoting and load planning.

## Acceptance criteria
- [x] Customer nav includes **Rate cards** at `/app/rate-cards` ([US-004](US-004-authenticated-app-shell.md))
- [x] Addresses list pattern: AG Grid on desktop, `app-data-list` at ≤720px; server pagination (default **25**; sizes **10**, **25**, **50**, **100**, **200**), **search**, **sort**, and column **filters**
- [x] List columns: **Profile name**, **User type** (Customer | Provider), **Customers** or **Providers** (linked company business names; one name per line when multiple; **All customers** / **All providers** when unrestricted), **Active**; row action **Edit**; **Create rate card** navigates to create
- [x] Create at `/app/rate-cards/create`, edit at `/app/rate-cards/:id/edit` (full page, not a modal); form uses full content width; **user type** `app-radio-card-group` is only as wide as its options (not stretched)
- [x] Zone rate rows use **autocomplete comboboxes** for collection and delivery zone (same interaction as address zone picker: type to filter, pick from suggestions)
- [x] Card fields: **profile name** (required, unique per owning company), **user type** (`customer` | `provider`) via reusable **radio card** control (unselected cards dimmed; selected card highlighted with brand `#f05a28`), optional **companies** multi-select (other `companies` rows; excludes own company; empty = applies to all), **minimum price** (≥ 0), **active** (default on), **zone rates** (≥ 1 row: collection zone, delivery zone, base rate ≥ 0, fuel surcharge % ≥ 0; unique collection+delivery pair per card)
- [x] When user type is **Customer**, company restrictions are **Customers**; when **Provider**, restrictions are **Providers**; saving replaces the restriction list; switching type on save clears the previous type’s restrictions
- [x] **Inactive** cards remain on the list and can be reactivated; no delete
- [x] `GET/POST /api/rate-cards`, `GET/PUT /api/rate-cards/{rateCard}`, `GET /api/rate-cards/company-options?q=` — authenticated **customer** with a company only; admins/guests **401/403**; other companies’ cards **404**
- [x] Zones on zone rows must be **active** zones in the company’s country (same rule as [US-010](US-010-customer-address-management.md) `zone_id`)
- [x] Minimum-price rule for future rating: if **rate × qty** is below **minimum price**, **minimum price** wins (stored only in this story; no quote API)

## Notes
- Out of scope: price calculation API, quantity, accessorials, effective dates, delete card.
- Owning company: [US-012](US-012-user-belongs-to-company.md); entity: [US-011](US-011-company-entity.md).
- Zone catalogue: [US-017](US-017-admin-zone-management.md); customer zone picker uses `GET /api/addresses/zone-options`.
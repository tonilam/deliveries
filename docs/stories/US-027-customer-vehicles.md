# Customer vehicles

## Story
As a customer user, I want to choose which vehicle body types my company uses, so that vehicle lists only offer the types we actually run.

## Acceptance criteria
- [x] Customer nav includes **Vehicles** immediately after **Network**, at `/app/vehicles` ([US-004](US-004-authenticated-app-shell.md))
- [x] The page lists every **non-deleted** body type in every **non-deleted** category (system catalogue). Nothing is active until this company turns it on
- [x] The user can activate or deactivate a body type for **their** company only. Another company’s choices do not appear here
- [x] Soft-deleted body types are omitted. Body types whose category is soft-deleted are omitted. A soft-deleted body type cannot be activated (**404**)
- [x] Customers cannot create, edit, or delete catalogue rows (that remains [US-016](US-016-admin-vehicle-catalogue.md))
- [x] `GET /api/vehicles` returns the catalogue with `active` per body type. `PUT /api/vehicles/body-types/{bodyType}` with `{ "active": true|false }` turns a type on or off
- [x] `GET /api/vehicles/body-type-options` returns only body types **active for the caller’s company** (still excluding soft-deleted types and types in soft-deleted categories). Vehicle pickers and autocomplete fields must use this endpoint
- [x] Guest **401**. Admin, and a customer with no company, **403**
- [x] Customer payloads do not include option definitions or `option_values`

## Notes
- Activation is the signed-in user’s company, not a network child.
- No vehicle picker exists on loads or rate cards yet. This story adds the options API those pickers must call. It does not add a vehicle field to loads or rate cards.
- Public vs system option visibility remains a later story ([US-016](US-016-admin-vehicle-catalogue.md)).
- Inactive means no pivot row. Active means a row in `company_vehicle_body_types`. Turning a type off deletes that row. A later admin restore of a soft-deleted body type keeps the company’s previous choice.
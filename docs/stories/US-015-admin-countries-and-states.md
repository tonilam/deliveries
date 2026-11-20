# Admin countries and states

## Story
As an admin user, I want to manage countries and their states/regions from System settings, so that the system has a maintained geographic reference list.

## Acceptance criteria
- [x] Admin **System settings** (`/admin/settings`) shows a **left settings menu**; **Countries** is the first item and the default landing page
- [x] Admins can **list** all countries with nested states (each with **code** and **name**)
- [x] Admins can **add, edit, and delete** countries (`name` + ISO 3166-1 alpha-2 `code`)
- [x] Admins can **add, edit, and delete** states within a country (`code` + `name`); state codes are unique per country
- [x] Delete country cascades to its states; delete actions require confirmation in the UI
- [x] Admin-only APIs (`/api/admin/countries` and nested state routes); customers and guests receive 401/403
- [x] `AustraliaCountrySeeder` seeds Australia (`AU`) and its 8 states/territories
- [x] `NewZealandCountrySeeder` seeds New Zealand (`NZ`) and its 16 regions (separate seeder class)
- [x] Companies reference a country ([US-011](US-011-company-entity.md)); customer address create and edit use that country’s states as a dropdown ([US-010](US-010-customer-address-management.md))

## Notes
- Extends System settings placeholder from [US-002](US-002-admin-portal-and-roles.md); Features stay on `/admin/features` ([US-006](US-006-admin-feature-toggles.md)).
- Seeders are idempotent (`updateOrCreate` on country/state code). Run separately:
  - `php artisan db:seed --class=AustraliaCountrySeeder`
  - `php artisan db:seed --class=NewZealandCountrySeeder`
- Customer-facing API is limited to state options for the signed-in customer’s company country (`GET /api/addresses/state-options`); full country CRUD remains admin-only.
- Deleting a country that is still referenced by companies is blocked (`restrictOnDelete`).

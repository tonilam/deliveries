# Admin zone management

## Story
As an admin user, I want to manage freight zones (cities and urban areas) from System settings, so that the system has a maintained zone catalogue linked to countries.

## Acceptance criteria
- [x] Admin **System settings** left menu includes **Zones** after **Countries** at `/admin/settings/zones`
- [x] Admins can **list** zones with **name**, **code**, **country**, and **active** status; list is **server-paginated** (default 25; sizes 10, 25, 50, 100, 200) with server **search**, **sort**, and column **filters** on desktop (AG Grid); on compact viewports (≤720px) a **data list** with the same server query params
- [x] Admins can **create** zones at `/admin/settings/zones/create` and **edit** via an in-page modal (`name`, unique-per-country `code`, `country_id`, **`is_active`** checkbox defaulting on)
- [x] **Inactive** zones stay on the admin list but are omitted from `GET /api/admin/zones/options`; historical `GET /api/admin/zones/{zone}` still returns inactive zones
- [x] **Delete** soft-deletes a zone (confirmation in UI); soft-deleted zones are hidden from the default list
- [x] Admin-only APIs under `/api/admin/zones`; guests and customers receive 401/403
- [x] `AustraliaZoneSeeder` seeds ABS 2021 Significant Urban Areas for AU; `NewZealandZoneSeeder` seeds Stats NZ 2023 urban areas (10,000+ residents) for NZ; both idempotent on `(country_id, code)` with `is_active` true
- [x] Deleting a country that still has zones is blocked (extends [US-015](US-015-admin-countries-and-states.md))

## Notes
- Customer address `zone` remains free text ([US-010](US-010-customer-address-management.md)); FK/dropdown is a later story
- Run seeders separately: `php artisan db:seed --class=AustraliaZoneSeeder`, `php artisan db:seed --class=NewZealandZoneSeeder`
- Picker contract: create/edit forms that choose a zone must use `/api/admin/zones/options`, not the paginated list
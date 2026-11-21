# Admin vehicle catalogue

## Story
As an admin user, I want to manage vehicle categories, body types, and body-type options from a **Vehicles** page, so that the system has an accurate Australian freight catalogue for planning and future customer flows.

## Acceptance criteria
- [x] Admin portal has **Vehicles** in nav (after Companies) at `/admin/vehicles`
- [x] Admins can **list, create, edit, and soft-delete** vehicle categories (`name`, unique `code`, `sort_order`); soft-deleted categories are hidden from default lists; delete is rejected while any body type belongs to the category
- [x] **Vehicles** home shows **one AG Grid per category** with nested body types (client-side pagination, column sort, floating filters; Edit/Delete actions); `GET /api/admin/vehicle-categories?catalogue=1` returns all categories with `body_types`
- [x] A **category visibility** toolbar at the top has an **All categories** checkbox plus one checkbox per category to show or hide that category’s section (suited to a small category set)
- [x] Paginated category list API remains available without `catalogue=1` for future use
- [x] Admins can **list, create, edit, and hard-delete** body types under a category; each body type belongs to **one** category (`code` unique per category)
- [x] Body types include `capacity`, `capacity_unit` (`pallet`, `m3`, `tonne`, `litre`, `head`), optional `pallet_spaces`, `cubic_metres`, `payload_kg`, `description`, and **`option_values`** JSON (validated against option definitions; no defaults on definition rows)
- [x] Admins can **CRUD option definitions** per body type (`key`, `label`, `data_type` `varchar`|`boolean`, `visibility` `public`|`system`, `required`, `sort_order`); values live in body type `option_values` only
- [x] `AustraliaVehicleSeeder` seeds common Australian categories, body types, and `mezzanine` option where applicable; idempotent on codes; **no** `load_type` on catalogue
- [x] Admin-only APIs; customers and guests receive 401/403

## Notes
- Category **edit** uses an in-page modal on `/admin/vehicles` (≤5 simple fields); **create** uses `/admin/vehicles/categories/create` ([simple-entity-edit-modal](../../.cursor/skills/simple-entity-edit-modal/SKILL.md)).
- Builds on [US-002](US-002-admin-portal-and-roles.md). Customer visibility of `public` options is a later story.
- Per-shipment `load_type` is out of scope (future load/delivery story).
- Run seeder: `php artisan db:seed --class=AustraliaVehicleSeeder`
# 2026-11-21 — Admin zone management

- Added [US-017](../stories/US-017-admin-zone-management.md): admin **Zones** under System settings with paginated list, create page, edit modal, soft delete, and `is_active` flag.
- Updated [US-015](../stories/US-015-admin-countries-and-states.md): country delete blocked when zones exist.
- New `zones` table (`country_id`, `name`, `code`, `is_active`, soft deletes).
- Admin APIs: `/api/admin/zones`, `/api/admin/zones/options`, CRUD.
- `AustraliaZoneSeeder` (ABS 2021 SUAs) and `NewZealandZoneSeeder` (Stats NZ 2023 urban areas 10k+).
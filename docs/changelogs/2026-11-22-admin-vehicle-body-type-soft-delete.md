# 2026-11-22 — Admin vehicle body type soft delete

- Updated [US-016](../stories/US-016-admin-vehicle-catalogue.md): body types are **soft-deleted** like categories and goods types; option definitions stay in the database.
- Migration: `deleted_at` on `vehicle_body_types`; `VehicleBodyType` uses `SoftDeletes`.
- `AustraliaVehicleSeeder` uses `withTrashed()` and restores soft-deleted seeded rows.
- Delete confirmation copy no longer says option definitions are removed.
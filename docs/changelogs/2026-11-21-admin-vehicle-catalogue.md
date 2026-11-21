# 2026-11-21 — Admin vehicle catalogue

- Added [US-016](../stories/US-016-admin-vehicle-catalogue.md): admin **Vehicles** page for categories (soft delete), body types, option definitions, and `option_values` JSON on body types.
- New tables: `vehicle_categories`, `vehicle_body_types`, `vehicle_body_type_options`.
- `AustraliaVehicleSeeder` seeds common AU categories, body types, and `mezzanine` option on applicable tautliner / mezzanine-curtain rows.
- Admin APIs under `/api/admin/vehicle-categories` (nested body types and options).
- Vehicles page: one body-type table per category with per-category show/hide checkboxes; `?catalogue=1` loads the full nested catalogue.
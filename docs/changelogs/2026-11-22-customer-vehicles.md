# Customer vehicles

- Story: [US-027](../stories/US-027-customer-vehicles.md); nav update in [US-004](../stories/US-004-authenticated-app-shell.md).
- API: `GET /api/vehicles`, `PUT /api/vehicles/body-types/{bodyType}`, `GET /api/vehicles/body-type-options`; pivot `company_vehicle_body_types`.
- Web: customer `/app/vehicles` — catalogue with per-company activation (desktop AG Grid, compact data list).
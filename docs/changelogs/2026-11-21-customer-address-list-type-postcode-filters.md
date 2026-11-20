# 2026-11-21 — Customer address list Type and Postcode filters

- Updated [US-010](../stories/US-010-customer-address-management.md): **Type** column uses a custom checkbox filter (community `SetFilter` is enterprise-only) for **Collection** / **Delivery**; **Postcode** uses a numeric filter with comparison operators; both remain server-side.
- API `GET /api/addresses` accepts postcode filter types `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, and `inRange` (with optional `filterTo`).
- Postcode numeric comparisons use `CAST(… AS UNSIGNED)` on MySQL/MariaDB (fixes 500s with `CAST AS INTEGER`, which SQLite tests used).
# 2026-11-22 — Load pickup and drop-off schedule

- Updated [US-024](../stories/US-024-customer-loads.md): each load (direct and child) stores required pickup and drop-off date and time.
- API: `pickup_date`, `pickup_time`, `dropoff_date`, `dropoff_time` on `loads`; validation ensures drop-off is on or after pickup.
- UI: shared schedule fields on create/edit (direct, Add Drop, X Dock modal), move-to-child flows, and **Pickup** / **Drop-off** columns on Deliveries.
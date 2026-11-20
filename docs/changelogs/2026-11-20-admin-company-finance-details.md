# 2026-11-20 — Admin company finance details

- Added [US-014](../stories/US-014-admin-company-finance-details.md): edit company **Finance** tab for invoicee name, GST %, and tracking option.
- Create company stays identity/contact only; after create, admins land on the edit page (Finance tab).
- Companies gain `gst_rate` (default `0.1`) and optional `tracking_option`; invoicee name is optional and set on Finance ([US-011](../stories/US-011-company-entity.md), [US-013](../stories/US-013-admin-company-management.md)).
- GST is entered as a percentage in the UI and stored as a fraction; Finance saves without the uniqueness confirmation modal.

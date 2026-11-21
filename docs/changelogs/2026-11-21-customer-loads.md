# 2026-11-21 — Customer loads

- Added [US-024](../stories/US-024-customer-loads.md): Deliveries lists **loads** (direct with nested Add Drop / X Dock), create/edit flows, pallet count, party and address rules, **Manage Item** 50vw slider.
- **Move to child** from Manage items on a direct load: assign item to an existing child or create Add Drop / X Dock child in one step (`POST /api/loads/{load}/items/{item}/move`).
- **X Dock edit** opens a four-field modal on Deliveries (and from the direct load child list) instead of the edit route; `/app/deliveries/:id/edit` redirects X Dock rows to Deliveries with the modal.
- Updated [US-023](../stories/US-023-customer-delivery-items.md): items managed in the slider; `load_id` / `unassigned` list filters; optional `load_id` on create.
- Customer APIs: `/api/loads`, assign/unassign `/api/loads/{load}/items`, `items.load_id` migration.
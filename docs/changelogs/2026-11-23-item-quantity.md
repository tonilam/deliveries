# 2026-11-23 — Item quantity (weight per unit)

- Updated [US-023](../stories/US-023-customer-delivery-items.md): `weight_tonnes` is weight **per unit**; added required **`quantity`** (unsigned integer, default 1 for existing rows).
- API exposes computed **`total_weight_tonnes`** (`weight_tonnes × quantity`, 6 decimal places); not stored or writable.
- Manage Item create modal: **Weight per unit**, quantity (default 1); nested item grid shows quantity and total weight.
- Related story wording: [US-024](../stories/US-024-customer-loads.md), [US-028](../stories/US-028-customer-load-activity.md).

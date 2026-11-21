# Customer delivery items

## Story
As a customer user, I want to manage items for my company’s freight, so that I can record goods type, weight, and references and assign them to loads.

## Acceptance criteria
- [x] Item CRUD fields: **goods type** (required, `good_types.code`), **weight** (required, &gt; 0), **display unit** (`tonnes` | `kg`), optional **order number**, optional **connote**
- [x] Database stores **`weight_tonnes`**; API exposes `weight_tonnes` and `display_unit`; client converts kg ↔ tonnes
- [x] `GET /api/items/good-type-options` returns active goods types for the picker
- [x] `GET /api/items` supports optional **`load_id`** (assigned to that load) and **`unassigned=1`** with existing pagination, search, sort, and filters
- [x] `POST /api/items` accepts optional **`load_id`** (must belong to the company) when creating from the load item slider
- [x] `GET/POST/PUT/DELETE /api/items` and `/api/items/{item}` — authenticated **customers** with a company; scoped to the user’s company; guests/admins **401/403**; other company’s item **404**
- [x] Items are managed from the **Manage Item** slider on [US-024](US-024-customer-loads.md) Deliveries (assigned / unassigned tabs; create, edit, delete, assign, unassign)—not a standalone item list on Deliveries
- [x] An item belongs to at most one load (`load_id`); deleting a load unassigns its items; deleting an item removes the row

## Notes
- Load planning and Deliveries list UI: [US-024](US-024-customer-loads.md).
- Goods catalogue: [US-022](US-022-admin-goods-types.md).
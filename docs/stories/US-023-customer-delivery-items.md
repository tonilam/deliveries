# Customer delivery items

## Story
As a customer user, I want to manage items on the Deliveries page, so that I can record freight details (goods type, weight, and references) for my company before full delivery planning exists.

## Acceptance criteria
- [x] Customer left menu **Deliveries** (`/app/deliveries`) lists the signed-in customer’s **company** items (not a placeholder)
- [x] On **desktop**, list uses **AG Grid** with server **pagination** (default 25; sizes 10, 25, 50, 100, 200), server **search**, **sort**, and column **filters**; on **compact** viewports (≤720px), **data list** with the same server query behaviour
- [x] Columns include **goods type** (name), **weight** (shown in the row’s **display unit**), **display unit**, **order number**, **connote**, and row **Actions** (**Edit**, **Delete**)
- [x] Customer can **create** and **edit** items in-page **modals** (no separate edit route)
- [x] Item fields: **goods type** (required, links to `good_types.code`), **weight** (required, &gt; 0), **display unit** (`tonnes` | `kg`), optional **order number**, optional **connote**
- [x] Database always stores weight as **`weight_tonnes`**; API exposes `weight_tonnes` and `display_unit`; the client converts for forms and list display (kg ↔ tonnes)
- [x] **Delete** asks for confirmation, then removes the item and refreshes the list
- [x] `GET /api/items/good-type-options` returns active goods types for the picker; customers cannot use admin goods-type APIs
- [x] `GET /api/items` list; `POST`, `GET`, `PUT`, `DELETE` on `/api/items/{item}` — authenticated **customers** with a company only; scoped to the user’s company
- [x] Guests and admins receive **401**/**403** on item endpoints; another company’s item returns **404** on show/update/delete
- [x] Full parent **delivery** (pickup/drop-off, dates) is out of scope

## Notes
- Extends [US-004](US-004-authenticated-app-shell.md) customer **Deliveries** nav; goods catalogue: [US-022](US-022-admin-goods-types.md).
- List patterns match [US-010](US-010-customer-address-management.md) (server-side grid / compact data list).
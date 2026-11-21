# Customer load management

## Story
As a customer user, I want to manage loads on the Deliveries page, so that I can plan freight from collection to delivery—including Add Drop and X Dock legs—and assign items to each load.

## Acceptance criteria
- [ ] Customer **Deliveries** (`/app/deliveries`) lists the company’s **direct** loads (not a flat item list)
- [ ] List pattern: **AG Grid** desktop with server pagination (default 25; 10, 25, 50, 100, 200), search, sort, column filters; **data list** ≤720px with the same server query
- [ ] Direct rows with **Add Drop** or **X Dock** children **expand** to a nested grid of those child loads
- [ ] **Pure direct** loads (no children) with items **expand** to a read-only nested grid of items on that load
- [ ] Each **child load** row with items **expands** to a read-only nested grid of that child’s items
- [ ] Nested **item** rows are display-only (goods type, weight, order number, connote); assign/edit/delete remains in **Manage Item**
- [ ] Columns include **load ID**, **customer**, **provider**, **collection**, **delivery**, **pickup date**, **pickup time**, **drop-off date**, **drop-off time**, **pallets**, **item count** (parent row shows **own items plus all child loads**; child rows show only that load’s items)
- [ ] **Collection**, **delivery**, and nested **X dock** / **delivery** cells show the address **business name** on the first line and the street **address** on a second line in smaller text (combined `Name — address` string remains in API for pickers and labels)
- [ ] When a direct load has **child loads** but still has items on the **parent**, the parent **Items** cell shows a red background and **Check items**
- [ ] Row actions: **Edit**, **Delete**, **Manage Item** (all load types including children)
- [ ] **Create load** at `/app/deliveries/create`; **edit** at `/app/deliveries/:id/edit` for **direct** and **Add Drop** child loads; **X Dock** child **edit** uses an in-page **modal** (Deliveries list and direct load edit) — not the edit route
- [ ] Load types: **Direct** (collection + delivery), **Add Drop** (same collection as parent, different delivery, same customer/provider as parent), **X Dock** (parent collection, x-dock delivery address, final delivery, **secondary provider** from network)
- [ ] Party rules: owner **customer** → customer is owner company, provider from network; owner **provider** → provider is owner, customer from network; owner **broker** → both from network
- [ ] Addresses must be owner company **collection** or **delivery** types as appropriate; direct collection ≠ delivery
- [ ] **Pallet count** required integer ≥ 0 per load
- [ ] Each load (direct and every child load) has required **pickup date**, **pickup time**, **drop-off date**, and **drop-off time**; drop-off is on or after pickup; child loads set their own schedule (not copied from the parent)
- [ ] **Manage Item** opens a **50vw** right slider (100vw compact): tabs **On this load** | **Available items**; server-paginated item lists; **Add** / **Remove** assign; **Available items** has **New item** opening a create modal (goods type, weight, unit, optional refs) with **Assign to this load** checkbox (default checked); **Edit** / **Delete** items in slider
- [ ] On a **direct** load, each assigned item has **Move to child**: move onto an **existing** Add Drop / X Dock child or **create** a new child (Add Drop: delivery + pallets, parent provider; X Dock: x-dock + final delivery + network provider + pallets); `POST /api/loads/{load}/items/{item}/move` in one transaction
- [ ] Only **unassigned** items can be assigned; assign to another load **422**; delete load unassigns items (direct delete removes children and unassigns all)
- [ ] Provider owner cannot create **X Dock** (no network providers) — API **422** and UI hidden/disabled
- [ ] `GET/POST /api/loads`, `GET/PUT/DELETE /api/loads/{load}`, `POST /api/loads/{load}/children`, party/address options, `POST/DELETE` load item assign/unassign — customer with company only; **401/403/404** as for other customer resources

## Notes
- Items: [US-023](US-023-customer-delivery-items.md) (fields and weight storage unchanged).
- Addresses: [US-010](US-010-customer-address-management.md); network: [US-019](US-019-customer-network.md); company types: [US-020](US-020-admin-company-type.md).
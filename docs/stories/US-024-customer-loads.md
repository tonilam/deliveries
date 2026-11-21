# Customer load management

## Story
As a customer user, I want to manage loads on the Deliveries page, so that I can plan freight from collection to delivery—including Add Drop and X Dock legs—and assign items to each load.

## Acceptance criteria
- [ ] Customer **Deliveries** (`/app/deliveries`) lists the company’s **direct** loads (not a flat item list)
- [ ] List pattern: **AG Grid** desktop with server pagination (default 25; 10, 25, 50, 100, 200), search, sort, column filters; **data list** ≤720px with the same server query
- [ ] Direct rows **expand** to show nested grid of **Add Drop** and **X Dock** child loads
- [ ] Columns include **customer**, **provider**, **collection**, **delivery**, **pallets**, **item count**
- [ ] Row actions: **Edit**, **Delete**, **Manage Item** (all load types including children)
- [ ] **Create load** at `/app/deliveries/create`; **edit** at `/app/deliveries/:id/edit` (direct and child loads)
- [ ] Load types: **Direct** (collection + delivery), **Add Drop** (same collection as parent, different delivery, same customer/provider as parent), **X Dock** (parent collection, x-dock delivery address, final delivery, **secondary provider** from network)
- [ ] Party rules: owner **customer** → customer is owner company, provider from network; owner **provider** → provider is owner, customer from network; owner **broker** → both from network
- [ ] Addresses must be owner company **collection** or **delivery** types as appropriate; direct collection ≠ delivery
- [ ] **Pallet count** required integer ≥ 0 per load
- [ ] **Manage Item** opens a **50vw** right slider (100vw compact): tabs **Assigned to This Load** | **Unassigned Item**; server-paginated item lists; **Add** / **Remove** assign; **New item** creates item already on that load; **Edit** / **Delete** items in slider
- [ ] Only **unassigned** items can be assigned; assign to another load **422**; delete load unassigns items (direct delete removes children and unassigns all)
- [ ] Provider owner cannot create **X Dock** (no network providers) — API **422** and UI hidden/disabled
- [ ] `GET/POST /api/loads`, `GET/PUT/DELETE /api/loads/{load}`, `POST /api/loads/{load}/children`, party/address options, `POST/DELETE` load item assign/unassign — customer with company only; **401/403/404** as for other customer resources

## Notes
- Items: [US-023](US-023-customer-delivery-items.md) (fields and weight storage unchanged).
- Addresses: [US-010](US-010-customer-address-management.md); network: [US-019](US-019-customer-network.md); company types: [US-020](US-020-admin-company-type.md).
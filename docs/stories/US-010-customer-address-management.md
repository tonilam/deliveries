# Customer address management

## Story
As a customer, I want to manage my company’s collection and delivery addresses, so that I can reuse them when planning loads.

## Acceptance criteria
- [x] Customer left menu includes **Addresses** linking to `/app/addresses`
- [x] Addresses page lists the signed-in customer’s **company** addresses (type, business name, address, zone, state, postcode); on **desktop** in an **AG Grid** table; on **compact** viewports (**720px** or narrower) in a **data list** with business name as title, one labeled line per other column, and up to **two** action buttons (Edit, Delete)
- [x] On compact viewports, a **search** field filters the list server-side across all listed columns; a **sort by** control picks the sort column and direction (same server `sort` / `direction` as desktop; default **Business name** ascending)
- [x] Address type is `collection` or `delivery`
- [x] The addresses list is **server-paginated**: default page size **25**; page size options **10**, **25**, **50**, **100**, **200**; UI shows range + total and lets the customer change page and page size; the grid grows to show all rows on the current page (no fixed viewport height / inner scroll)
- [x] Column filters stay available in the AG Grid UI for **Type**, **Business name**, **Address**, **Zone**, **State**, and **Postcode**; filtering is applied **server-side** (with pagination totals reflecting the filtered set)
- [x] **Type** uses a compact dropdown in the floating filter row (2nd row); opening it shows **Collection** / **Delivery** checkboxes (consistent with other columns’ inline controls)
- [x] **Postcode** uses a numeric filter with comparison operators (e.g. greater than, less than)
- [x] Column sorting is available in the AG Grid UI for those same columns; sorting is applied **server-side** (single column; default **Business name** ascending)
- [x] Each row has **Actions** with **Edit** and **Delete**
- [x] A button opens a separate page to add a new address
- [x] Create and edit forms capture: type, address, zone, state, postcode, business name; saving persists for the customer’s **company** and returns to the list
- [x] Edit opens a separate page (`/app/addresses/:id/edit`) prefilled with the address; saving updates that address
- [x] Delete asks for confirmation, then removes the address and refreshes the list
- [x] **State** on the create/edit form is a **dropdown** of states/regions for the customer’s company country (label = name, value = **code**); options come from `GET /api/addresses/state-options`
- [x] `POST /api/addresses` and `PUT /api/addresses/{address}` validate `state` as a state **code** that belongs to the company’s country
- [x] `GET /api/addresses` accepts `page`, `per_page` (allowed sizes above; default 25), optional `sort` / `direction` (sortable columns above; `asc`|`desc`; defaults `business_name` / `asc`), and optional column `filter` params, and returns the current page of addresses plus pagination meta
- [x] `GET /api/addresses` accepts optional `search` (contains match across type, business name, address, zone, state, and postcode) for compact list search
- [x] `POST /api/addresses` creates an address; `GET /api/addresses/{address}` returns one address; `PUT /api/addresses/{address}` updates it; `DELETE /api/addresses/{address}` removes it — all available to authenticated customers and scoped to the user’s company ([US-012](US-012-user-belongs-to-company.md))
- [x] Guests and admins cannot list, show, create, update, or delete company addresses (or state options) via those endpoints
- [x] A customer cannot show, update, or delete another company’s address
- [x] An address belongs to a [company](US-011-company-entity.md), not directly to a user

## Notes
- Menu item extends [US-004](US-004-authenticated-app-shell.md) customer nav.
- List behaviour matches companies ([US-013](US-013-admin-company-management.md)): server-side pagination, filtering, and sorting.
- Address `state` remains a string column storing the country-state **code** (not a foreign key).
- Admin management of addresses is out of scope for this story.
- Customers without a company cannot list or mutate addresses (forbidden).

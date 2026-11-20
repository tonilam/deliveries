# Customer address management

## Story
As a customer, I want to manage my company’s collection and delivery addresses, so that I can reuse them when planning loads.

## Acceptance criteria
- [x] Customer left menu includes **Addresses** linking to `/app/addresses`
- [x] Addresses page lists the signed-in customer’s **company** addresses in an AG Grid table (type, business name, address, zone, state, postcode)
- [x] Address type is `collection` or `delivery`
- [x] A button opens a separate page to add a new address
- [x] Create form captures: type, address, zone, state, postcode, business name; saving persists for the customer’s **company** and returns to the list
- [x] `GET /api/addresses` and `POST /api/addresses` are available to authenticated customers and scoped to the user’s company ([US-012](US-012-user-belongs-to-company.md))
- [x] Guests and admins cannot list or create company addresses via those endpoints
- [x] An address belongs to a [company](US-011-company-entity.md), not directly to a user

## Notes
- Menu item extends [US-004](US-004-authenticated-app-shell.md) customer nav.
- Edit/delete and admin management of addresses are out of scope for this story.
- Customers without a company cannot list or create addresses (forbidden).

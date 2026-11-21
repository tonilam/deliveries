# Admin goods types

## Story
As an admin user, I want to manage goods types from System settings, so that the system has a maintained catalogue for classifying freight (frozen, chilled, dry, and so on).

## Acceptance criteria
- [x] Admin **System settings** left menu includes **Goods** after **Zones** at `/admin/settings/goods`
- [x] Admins can **list** goods types with **code**, **name**, and **refrigerated required**; list is **server-paginated** (default 25; sizes 10, 25, 50, 100, 200) with server **search**, **sort**, and column **filters** on desktop (AG Grid); **refrigerated required** uses a **Yes | No** checkbox set filter (same pattern as address **Type** on the customer address list); on compact viewports (≤720px) a **data list** with the same server query params
- [x] Admins can **create** goods types at `/admin/settings/goods/create` (`code` unique business key e.g. `FRZ`, `name`, **`refrigerated_required`** boolean)
- [x] Admins can **edit** via an in-page modal (`name`, **`refrigerated_required`** only; **code** is read-only)
- [x] **Delete** soft-deletes a goods type (confirmation in UI); soft-deleted types are hidden from the default list and return **404** on show
- [x] Admin-only APIs under `/api/admin/good-types`; guests and customers receive 401/403
- [x] `GoodTypeSeeder` seeds frozen, chilled, dry, ambient, and general types idempotent on `code` (restores if previously soft-deleted)
- [x] Customers can assign a goods type on company delivery **items** ([US-023](US-023-customer-delivery-items.md)); full shipment/load assignment remains out of scope

## Notes
- `good_types.code` is the primary key (no autoincrement id exposed in API payloads).
- Run seeder: `php artisan db:seed --class=GoodTypeSeeder`
- Complements [US-016](US-016-admin-vehicle-catalogue.md) (vehicle catalogue); item-level assignment: [US-023](US-023-customer-delivery-items.md).
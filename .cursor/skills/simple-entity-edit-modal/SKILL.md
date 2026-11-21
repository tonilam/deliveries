---
name: simple-entity-edit-modal
description: >-
  Uses an in-page edit modal instead of a dedicated edit route when an admin
  entity has at most five simple scalar fields (text, number, select, checkbox).
  Use when adding or changing admin CRUD UI for small forms, edit modal patterns,
  or when the user references this skill or simple-field edit modals.
---

# Simple entity edit modal

## When to use

| Use modal for **edit** | Use a **full page** instead |
| --- | --- |
| ≤ **5** fields, mostly scalar | Tabs, nested lists, many fields, file upload |
| No heavy validation UX (no multi-step confirm modals) | Company-style uniqueness review modals |
| User stays in context (catalogue, list, settings) | First-time **create** when the form is the main focus |

**Create** may still use a route or modal; this skill targets **edit** by default.

## UI pattern (Angular admin)

1. Reuse existing **modal** markup from the same page (delete confirm, option form): `.modal-backdrop`, `.modal`, `.modal__actions`, `.btn`.
2. **Reactive form** in the host component (no new route for edit).
3. **Open**: patch form from the row/model; set `editModalOpen` + `editingId`.
4. **Save**: `PUT` via `AuthService.ensureCsrf()` → close modal → reload list/catalogue.
5. **Errors**: show API `errors` in the modal (`role="alert"`), not only page-level.
6. **Backdrop click**: cancel if not submitting.

## Do not

- Add a lazy-loaded `.../:id/edit` route for a ≤5-field edit.
- Mount AG Grid only for the modal.
- Open a second modal on top without closing the first.

## Reference implementation

Vehicle category **edit** on the catalogue page:

- [`apps/web/src/app/pages/admin/vehicles/vehicles.ts`](../../apps/web/src/app/pages/admin/vehicles/vehicles.ts) — form + `openEditCategory` / `saveCategory`
- [`apps/web/src/app/pages/admin/vehicles/vehicles.html`](../../apps/web/src/app/pages/admin/vehicles/vehicles.html) — edit modal block
- **Create** category: [`vehicle-category-form`](../../apps/web/src/app/pages/admin/vehicles/vehicle-category-form.ts) route only

Modal shell styling matches delete confirm on the same page ([`vehicles.scss`](../../apps/web/src/app/pages/admin/vehicles/vehicles.scss)).
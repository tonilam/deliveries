# 2026-11-21 — Customer address edit and delete

- Updated [US-010](../stories/US-010-customer-address-management.md): customers can **edit** and **delete** their company’s addresses (full CRUD).
- API: `GET/PUT/DELETE /api/addresses/{address}` (customer-only, scoped to the signed-in user’s company); other companies’ addresses return 404.
- Web: Addresses list **Actions** menu (Edit / Delete with confirmation); `/app/addresses/:id/edit` reuses the address form.

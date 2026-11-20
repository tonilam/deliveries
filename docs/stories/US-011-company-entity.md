# Company entity

## Story
As the product, I need a Company record with registration and billing details, so that customers, addresses, and invoices can be organised by business.

## Acceptance criteria
- [x] A `companies` table/model exists with: `reg_number`, `reg_type` (e.g. ABN), `business_name`, `invoicee_name` (optional), `phone`, `email`, `address`
- [x] Company has finance fields: `gst_rate` (fraction, default `0.1`), `tracking_option` (optional free text for Xero)
- [x] Company has an **allowed domains** list (email domains used to decide which customers may join)
- [x] Company can have many addresses ([US-010](US-010-customer-address-management.md))
- [x] Company can have many users ([US-012](US-012-user-belongs-to-company.md))

## Notes
- Admin company management UI: [US-013](US-013-admin-company-management.md); finance on edit: [US-014](US-014-admin-company-finance-details.md).
- `address` on Company is a free-text registered/billing address, distinct from collection/delivery [Address](US-010-customer-address-management.md) records.
- A given email domain may belong to at most one company’s allowed domains list.
- `gst_rate` is stored as a fraction (e.g. `0.1` = 10%); admins enter a percentage in the UI.

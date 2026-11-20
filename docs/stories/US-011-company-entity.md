# Company entity

## Story
As the product, I need a Company record with registration and billing details, so that customers, addresses, and invoices can be organised by business.

## Acceptance criteria
- [x] A `companies` table/model exists with: `reg_number`, `reg_type` (e.g. ABN), `business_name`, `invoicee_name`, `phone`, `email`, `address`
- [x] Company can have many addresses ([US-010](US-010-customer-address-management.md))
- [x] Company can have many users ([US-012](US-012-user-belongs-to-company.md))

## Notes
- Create/edit company UI and admin company management are out of scope here; follow-up stories will cover them.
- `address` on Company is a free-text registered/billing address, distinct from collection/delivery [Address](US-010-customer-address-management.md) records.

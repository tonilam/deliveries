# User belongs to a company

## Story
As a customer user, I belong to one company, so that my work (addresses, loads) is scoped to that business.

## Acceptance criteria
- [x] Users may have an optional `company_id` foreign key to [Company](US-011-company-entity.md)
- [x] A user belongs to at most one company; a company has many users
- [x] **Admin users do not belong to a company** (`company_id` is always null)
- [x] Customer address APIs use the signed-in user’s company ([US-010](US-010-customer-address-management.md))

## Notes
- Assigning a customer to a company on create/invite (and domain rules) is covered by [US-013](US-013-admin-company-management.md) and [US-007](US-007-admin-create-and-invite-users.md).
- Customers are expected to have a company when using company-scoped features.

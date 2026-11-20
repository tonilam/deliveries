# Admin company management

## Story
As an admin user, I want to manage companies (list, create, edit) and attach customer users to them, so that customers are organised under the right business and can only join via an allowed email domain.

## Acceptance criteria
- [x] Admin portal has a **Companies** page (`/admin/companies`) linked from admin nav
- [x] Companies are listed in an AG Grid table with columns: **Business name**, **Reg number**, **Email**, **Allowed domains**
- [x] A **Create company** button opens a create flow for company identity/contact fields from [US-011](US-011-company-entity.md), plus **allowed domains** (finance fields are set on edit — [US-014](US-014-admin-company-finance-details.md))
- [x] After successful create, the admin is redirected to that company’s **edit** page
- [x] Each row has an **Edit** action; edit has **Details** and **Finance** tabs ([US-014](US-014-admin-company-finance-details.md))
- [x] Saving create or **Details** edit opens a **confirmation modal** that shows **business name**, **reg number**, and **allowed domains** for the admin to review before the save is submitted
- [x] When the confirmation modal opens, it automatically calls an admin uniqueness-check API; while checking, a **spinner** is shown; each field then shows a **green check** if unique or a **red cross** if conflicting, and conflicting results ask the admin to review the data
- [x] Confirm save is only enabled when all checked fields pass
- [x] **Business name**, **reg number**, and each **allowed domain** must be unique across companies (no duplicates in the system); duplicates are rejected
- [x] Each company has an **Add customer** action that opens Create user with role=customer and that company preselected ([US-007](US-007-admin-create-and-invite-users.md))
- [x] Company has an **allowed domains** list (email domains, e.g. `acme.com`); a given domain may belong to at most one company
- [x] A customer may only be created, invited, or self-registered into a company when their email domain is on that company’s allowed domains list — **including when an admin creates or invites** (no override)
- [x] Public registration auto-assigns the matching company when exactly one company matches; if multiple match, the user must choose which company to join
- [x] Admin-only APIs for list/create/update company; customers and guests are rejected

## Notes
- Builds on [US-011](US-011-company-entity.md) and [US-012](US-012-user-belongs-to-company.md); admin users still never belong to a company.
- Finance details on edit: [US-014](US-014-admin-company-finance-details.md).
- Product intent today is one domain → one company; multi-match choice remains supported if data ever allows it.
- Out of scope: delete company, deactivate company, bulk import.

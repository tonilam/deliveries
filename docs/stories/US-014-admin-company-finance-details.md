# Admin company finance details

## Story
As an admin user, I want to set a company’s financial details on the edit page, so that invoicing and Xero tracking are configured after the company exists.

## Acceptance criteria
- [x] Create company flow stays on identity/contact fields only (no finance tab); **invoicee name** is not collected on create and is optional
- [x] After a successful create, the admin is redirected to that company’s **edit** page
- [x] Edit company has two tabs: **Details** (same fields as today’s edit form, without invoicee) and **Finance**
- [x] Finance tab fields: **Invoicee name** (optional), **GST %** (UI shows a `%` suffix; stored as a fraction, default `0.1` / 10%), **Tracking option** (optional free text, used by Xero integrations)
- [x] Required fields on create/edit forms show a red asterisk
- [x] Finance tab saves directly (no uniqueness confirmation modal)
- [x] Details tab keeps the existing uniqueness confirmation flow for business name, reg number, and allowed domains

## Notes
- Extends [US-013](US-013-admin-company-management.md) and [US-011](US-011-company-entity.md).
- GST is entered as a percentage in the UI (e.g. `10`) and persisted as a fraction (e.g. `0.1`).

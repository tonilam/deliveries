# Admin company type

## Story
As an admin user, I want to set each company’s type (Customer, Provider, or Broker), so that the product knows whether they only buy, only supply, or broker both sides of the network.

## Acceptance criteria
- [x] `companies.company_type` is **customer**, **provider**, or **broker** (existing rows default **broker**)
- [x] Root companies (`parent_company_id` null): admin sets **Company type** on create and edit (Details tab)
- [x] Linked companies (`parent_company_id` set): type is **customer** or **provider** only and must match the parent ([US-011](US-011-company-entity.md)); **Parent** business name is read-only on edit
- [x] Parent **Customer** may only have **provider** children; parent **Provider** may only have **customer** children; parent **Broker** may have either
- [x] Admin cannot change a root company’s type while it still has children of a disallowed type for the new type (e.g. a **Broker** with linked **customer** companies cannot become **Customer**; a **Broker** with linked **provider** companies cannot become **Provider**)
- [x] A linked company (`parent_company_id` set) cannot be saved as **Broker** (API and edit UI)
- [x] A linked company cannot change **Company type** between **customer** and **provider** while it remains linked to a parent (API rejects the save; edit UI disables the other type and shows “This is a {customer|provider} of {parent business name}” with the parent name linking to that company’s admin edit page)
- [x] Admin companies list shows **Company type** and **Parent** (parent business name; blank for roots); searchable, sortable, filterable server-side like other columns

## Notes
- Customer-managed links: [US-019](US-019-customer-network.md).
- Admin create still creates root companies only; customers attach children via Network ([US-019](US-019-customer-network.md)); admins may link existing root companies from the company **Network** tab ([US-021](US-021-admin-company-network.md)).
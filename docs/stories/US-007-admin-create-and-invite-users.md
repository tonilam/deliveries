# Admin create and invite users

## Story
As an admin user, I want to create a password admin or customer account with a temporary password, or invite a user by email to finish signup (password or SSO) with a role I choose, so that I can provision access without relying on public self-registration.

## Acceptance criteria
- [x] User management (`/admin/users`) has a **Create user** button that navigates to `/admin/users/create`
- [x] Create user preselects role from the active list tab (**Admin users** → admin, **Customer users** → customer); the admin can still change it
- [x] The create-user page and button remain available when the **User registration** feature flag is off (not hidden or blocked by that flag)
- [x] On the create-user page, the admin chooses mode: **Password account** or **Invite**, and role: **Admin** or **Customer**
- [x] When role is **Customer**, the admin must choose a **company** via a **debounced autocomplete** (search starts after **2 characters**, matching business names that **start with** the query; **↑/↓** move through suggestions, **Enter** selects, **Esc** closes); when opened from Companies with `company_id` query, that company is preselected and the picker is locked ([US-013](US-013-admin-company-management.md))
- [x] Customer create/invite is rejected unless the email domain is on the chosen company’s allowed domains list (no admin override)
- [x] **Password account**: admin submits name, email, and a temporary password (with confirmation); a control generates a random temporary password; an optional checkbox forces the user to change password on first login
- [x] **Invite**: admin submits name and email; API stores an invitation with the chosen role (and company for customers) and sends an email containing an invite link
- [x] Opening a valid invite link shows a register-style flow (email/password or Google/Apple SSO); completing it creates the user with the **admin-chosen role** (not always customer)
- [x] Invite acceptance works even when **User registration** is disabled; public `POST /api/register` and unsolicited SSO first-time signup remain blocked per [US-006](US-006-admin-feature-toggles.md)
- [x] Admin create/invite APIs succeed when **User registration** is disabled; only admins can create or invite; customers and guests are rejected
- [x] Duplicate email (existing user or pending invite) is rejected with a clear validation error
- [x] After a successful password create, the admin returns to User management and the new user appears in the matching tab
- [x] After a successful invite, the admin returns to User management with confirmation that the invitation was sent (user appears after they accept)
- [x] Users with force-change enabled must set a new password before using the rest of the app

## Notes
- Extends [US-003](US-003-admin-user-management-lists.md); identifier remains **email** ([US-001](US-001-user-auth-sso-and-password.md)), not a separate username field.
- Admins are still never auto-created on first unsolicited SSO login — [US-002](US-002-admin-portal-and-roles.md); invite + password create are the provisioning paths.
- Out of scope: edit user, deactivate/reactivate, resend invite UI, custom IdPs.

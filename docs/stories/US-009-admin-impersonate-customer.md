# Admin impersonate customer user

## Story
As an admin user, I want to impersonate a customer user from User management, so that I can see and use the app as that customer without signing in as them. Impersonating another admin is not allowed.

## Acceptance criteria
- [x] From User management **Customer users**, admin can **Impersonate** an active customer
- [x] Impersonating an **admin** user is not allowed (UI does not offer it; API rejects it)
- [x] Impersonating an **inactive** customer is not allowed (UI does not offer it; API rejects it)
- [x] After impersonation starts, the session acts as that customer and the admin is sent to the customer app (`/app`)
- [x] While impersonating, the avatar is replaced with **View as {name}**; the account menu includes **Return to admin** to end impersonation and restore the original admin session
- [x] Only admins can start impersonation; customers and guests are rejected
- [x] User management **Actions**: list available actions per row; if more than one action, show them in a dropdown menu; if exactly one, show that action directly
- [x] Customer actions include Impersonate (when allowed) and existing Reset password (when the user has a password)

## Notes
- Extends [US-003](US-003-admin-user-management-lists.md) / [US-008](US-008-admin-reset-user-password.md).
- Nested impersonation is out of scope; starting impersonation while already impersonating is rejected.
- Signing out while impersonating ends the whole session (does not silently return to the admin).

# Admin reset user password

## Story
As an admin user, I want to reset passwords for email/password users—set a new password for a customer, or email a reset link to an admin or customer—so that I can restore access without applying this to SSO-only accounts.

## Acceptance criteria
- [x] From User management, admin can open password-reset actions for a user who has a password
- [x] Admin can set a new password for a **customer** email/password user (with confirmation; optional require change on next login)
- [x] Admin can send a password-reset email to an **admin** or **customer** email/password user
- [x] Admin cannot set a new password directly for an admin user (email reset only)
- [x] SSO-only users (no password) cannot have a password set or a reset email sent; the UI does not offer those actions
- [x] Recipient can open the reset link (while logged out) and choose a new password
- [x] Only admins can call the admin reset/send APIs; customers and guests are rejected
- [x] Invalid or expired reset tokens are rejected with a clear error

## Notes
- Extends [US-003](US-003-admin-user-management-lists.md) / [US-007](US-007-admin-create-and-invite-users.md). Identifier remains **email** ([US-001](US-001-user-auth-sso-and-password.md)).
- Self-service “forgot password” from the login page remains out of scope; this story covers **admin-initiated** reset only.
- Out of scope: edit name/email, deactivate/reactivate, SSO account linking.

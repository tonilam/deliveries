# User profile and password update

## Story
As a signed-in user, I want to view my profile details and (if I signed up with email/password) update my password, so that I can manage my account from My Profile.

## Acceptance criteria
- [x] Authenticated user can open My Profile and see their details (at least name, email, and role)
- [x] `GET /api/user` indicates whether the user has a password (`has_password`) so the UI can tell SSO-only from password users
- [x] Password (non-SSO) users see a change-password form on the profile page
- [x] Password users can update their password by providing current password, new password, and confirmation; success updates the stored hash
- [x] SSO-only users (no password) do not see a change-password form and cannot call the password-update API successfully
- [x] Wrong current password or invalid new password returns validation errors

## Notes
- Builds on the My Profile entry point from [US-004](US-004-authenticated-app-shell.md); replaces the placeholder page.
- Password **reset** from login remains out of scope per [US-001](US-001-user-auth-sso-and-password.md); admin-initiated reset is [US-008](US-008-admin-reset-user-password.md).
- Editing name/email and account linking UI are out of scope for this story.

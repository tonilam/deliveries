# Session expiry while signed in

## Story
As a signed-in user, I want the app to notice when my session is no longer valid, so that I am returned to login and told that the session expired.

## Acceptance criteria
- [x] While a user is signed in (admin, customer, forced password change, or impersonating), the app calls `GET /api/user` every 5 minutes
- [x] The first check runs 5 minutes after the user becomes signed in, then every 5 minutes
- [x] If that call returns 401 or 419, the in-memory session is cleared and the user is sent to `/login?error=session_expired`
- [x] The login page shows: "Your session has expired. Please sign in again."
- [x] Avatar **Sign Out** still goes to `/login` with no session-expired message
- [x] A network failure or 5xx on the check does not log the user out
- [x] No new API route

## Notes
- Session model stays Sanctum SPA cookies ([US-001](US-001-user-auth-sso-and-password.md)).
- `GET /api/user` is already behind `auth:sanctum` and `active`. An inactive user gets 401 and the server session is invalidated (`EnsureUserIsActive`). A deleted session row (password reset) also returns 401.
- While impersonating, the check follows the current session user (the customer). A 401 ends the whole session, consistent with [US-009](US-009-admin-impersonate-customer.md).
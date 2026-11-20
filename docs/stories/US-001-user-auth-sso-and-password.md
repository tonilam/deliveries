# User auth: email/password and SSO

## Story
As a new user, I want to create an account and sign in with either email/password or an SSO IdP (Google or Sign in with Apple), so that I can access Loadplanner without a separate identity system.

## Acceptance criteria
- [x] New user can register with email + password and is logged in (Sanctum SPA session)
- [x] Existing user can log in with email + password
- [x] New or returning user can sign up / log in with Google via Socialite
- [x] New or returning user can sign up / log in with Apple via Socialite
- [x] Authenticated user can call a protected `GET /api/user` and can log out
- [x] SSO-only users can exist without a password; email/password users keep a hashed password
- [x] Unauthenticated access to protected API routes returns 401

## Notes
- Identifier is **email** (not a separate username field).
- Session model: Sanctum SPA cookies.
- Out of scope: public self-service forgot-password, email verification, account linking UI, additional IdPs, tenants. Admin-initiated password reset: [US-008](US-008-admin-reset-user-password.md). Roles and admin portal: [US-002](US-002-admin-portal-and-roles.md).
- Configure `GOOGLE_*` / `APPLE_*` in `apps/api/.env` before SSO works in a browser (see `.env.example`).

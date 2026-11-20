# 2026-11-20 — Email/password and SSO authentication

- Added user story [US-001](../stories/US-001-user-auth-sso-and-password.md): register/login with email+password or Google/Apple SSO.
- API: Laravel Socialite + Apple provider, nullable `users.password`, `social_accounts` table, Sanctum SPA session auth routes (`/api/register`, `/api/login`, `/api/logout`, `/api/user`, `/api/auth/{provider}/*`).
- Web: login/register pages, SSO redirect buttons, auth callback, auth guard, CSRF + credentials HTTP client.
- Feature tests cover password auth and mocked Socialite find-or-create/link flows.

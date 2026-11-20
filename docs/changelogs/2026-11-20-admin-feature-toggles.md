# 2026-11-20 — Admin feature toggles

- Added [US-006](../stories/US-006-admin-feature-toggles.md): admin Features page with on/off toggles and a confirmation modal.
- API: `features` table (seeded `user_registration` on); `GET /api/features` (public); admin `GET/PATCH /api/admin/features`.
- When user registration is off: `POST /api/register` and SSO first-time account creation are rejected; existing SSO logins still work.
- Web: `/admin/features` page + nav link; login hides “Create an account”; `/register` redirects to login when registration is disabled.
- Features page search filters the list by name, description, or key.

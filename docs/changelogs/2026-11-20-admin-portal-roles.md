# 2026-11-20 — Admin portal and role-based access

- Added [US-002](../stories/US-002-admin-portal-and-roles.md): admin vs customer areas in one Angular SPA with role-based guards.
- API: `users.role` (`customer`|`admin`) and `is_active`; register/SSO always provision customers; optional `ADMIN_EMAIL_DOMAIN` for admin Google SSO; `GET /api/admin/ping` behind admin middleware.
- Web: `/app` and `/admin` placeholder pages, shared login with post-auth redirect by role.
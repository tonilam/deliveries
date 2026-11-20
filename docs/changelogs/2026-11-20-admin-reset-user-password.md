# 2026-11-20 — Admin reset user password

- Added [US-008](../stories/US-008-admin-reset-user-password.md): admins can reset passwords for email/password users from User management.
- Web: **Reset password** action on password users → `/admin/users/:id/reset-password` (set password for customers; send reset email for admin or customer). Public `/reset-password` completes the emailed link.
- API: `GET /api/admin/users/{user}`, `PUT /api/admin/users/{user}/password` (customer password users), `POST /api/admin/users/{user}/password-reset`, `POST /api/password/reset`; user list includes `has_password`. SSO-only users are rejected for both admin actions. Direct set and token reset invalidate DB sessions; direct set also revokes outstanding reset tokens. Admin APIs require `password.changed`.

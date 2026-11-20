# 2026-11-20 — Admin impersonate customer

- Added [US-009](../stories/US-009-admin-impersonate-customer.md): admins can impersonate active customer users from User management; impersonating admins is blocked.
- API: `POST /api/admin/users/{user}/impersonate`, `POST /api/impersonation/leave`; `GET /api/user` includes `impersonating` / `impersonator`.
- Web: **Impersonate** on Customer users; Actions use a dropdown when more than one action is available; while impersonating the avatar becomes **View as {name}** and the account menu includes **Return to admin**.

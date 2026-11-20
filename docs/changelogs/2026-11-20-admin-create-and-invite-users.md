# 2026-11-20 — Admin create and invite users

- Added [US-007](../stories/US-007-admin-create-and-invite-users.md): admins can create password users or invite users by email from User management.
- Web: **Create user** on `/admin/users` → `/admin/users/create` (password + generate temp password + optional force change; or invite); role preselected from the active Admin/Customer tab. Invite accept at `/invite/:token` (password or SSO). Force-change gate at `/change-password`.
- API: `POST /api/admin/users`, `POST /api/admin/invitations`, `GET/POST /api/invitations/{token}`; `users.must_change_password`; `user_invitations` + invitation email. Admin create/invite and invite acceptance are not gated by the User registration feature flag.

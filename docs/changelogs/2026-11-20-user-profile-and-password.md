# 2026-11-20 — User profile and password update

- Added user story [US-005](../stories/US-005-user-profile-and-password.md): view profile details; password users can change password.
- API: `GET /api/user` includes `has_password`; `PUT /api/user/password` for authenticated password users (current + new + confirmation).
- Web: My Profile shows name, email, role, and sign-in type; change-password form for non-SSO users; SSO-only note when no password.
- Updated [US-004](../stories/US-004-authenticated-app-shell.md) so My Profile points at the real profile page instead of a placeholder.

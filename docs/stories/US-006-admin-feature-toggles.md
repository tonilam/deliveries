# Admin feature toggles

## Story
As an admin user, I want to turn system features on or off from a Features page in the admin portal, so that I can control capabilities like user registration without a deploy.

## Acceptance criteria
- [x] Admin portal has a Features page at `/admin/features`, linked in the admin sidebar
- [x] Features page lists available features; each row shows name, short description, and an on/off toggle
- [x] Features page has a search bar at the top that filters the list by name or description
- [x] Initial feature: **User registration** — when off, new email/password registrations and SSO first-time account creation are rejected by the API
- [x] When registration is off, the public register UI is hidden (no register route/links for guests)
- [x] When an admin toggles a feature, a confirmation modal appears; the change is applied only after the admin confirms
- [x] Cancelling the modal leaves the feature state unchanged
- [x] Feature state is persisted server-side and loaded when the Features page opens
- [x] Only admins can list or update features; customers and guests cannot
- [x] Guests can learn whether registration is enabled (so the public UI can hide register)

## Notes
- New page (not the existing System Settings placeholder at `/admin/settings`).
- Extends admin portal from [US-002](US-002-admin-portal-and-roles.md); auth mechanics remain in [US-001](US-001-user-auth-sso-and-password.md).
- Decisions: block both password and SSO new-user creation when off; hide register UI; default User registration **on**.

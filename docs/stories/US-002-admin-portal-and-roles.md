# Admin portal and role-based access

## Story
As an admin user, I want access to an admin portal separate from the customer-facing app, so that I can manage system settings and users while customers only see delivery-related experiences.

## Acceptance criteria
- [x] Every user has a role: `customer` or `admin`; new registrations and SSO sign-ups create only `customer` accounts
- [x] Admin accounts are never auto-created on first login; admins must be provisioned in advance with `role=admin`
- [x] One shared `/login` and SSO flow; after successful auth, admins land on `/admin` and customers on `/app`
- [x] Angular guards prevent customers from opening `/admin/**` and admins from opening `/app/**` (redirect to their home)
- [x] Placeholder pages: admin System Settings (`/admin/settings`), User Management (`/admin/users`); customer Dashboard (`/app`), Deliveries list (`/app/deliveries`) — user lists: [US-003](US-003-admin-user-management-lists.md)
- [x] `GET /api/user` includes `role`; admin-only API routes require admin role
- [x] Google SSO requires a verified email before linking to an existing account by email
- [x] Inactive users (`is_active=false`) cannot sign in

## Notes
- Single `users` table + roles; one Sanctum SPA session (see US-001).
- One Google OAuth client; post-login separation by role (not separate `/admin/login`).
- Optional `ADMIN_EMAIL_DOMAIN` enforces company email + Google `hd` claim for admin SSO when configured.
- US-001 remains the source for password/SSO mechanics; roles live in this story.
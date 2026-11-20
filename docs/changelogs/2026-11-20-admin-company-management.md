# 2026-11-20 — Admin company management

- Added [US-013](../stories/US-013-admin-company-management.md): admin Companies page (AG Grid list, create/edit, add customer).
- Companies gain `allowed_domains`; a domain may belong to at most one company ([US-011](../stories/US-011-company-entity.md)).
- Customer create/invite requires a company; email domain must be on that company’s allow list — no admin override ([US-007](../stories/US-007-admin-create-and-invite-users.md)).
- Self-registration / SSO assigns a matching company; unknown domains are rejected; multiple matches require a company choice ([US-001](../stories/US-001-user-auth-sso-and-password.md)).
- Create/edit company shows a confirmation modal for business name, reg number, and allowed domains; those fields (plus domains) must be unique system-wide.
- Confirmation modal auto-checks uniqueness via API with per-field spinner / pass / fail icons; confirm stays disabled until all fields pass.

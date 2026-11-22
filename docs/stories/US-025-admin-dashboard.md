# Admin home dashboard

## Story
As an admin user, I want a dashboard on the admin portal home page, so that I can see user and company totals, weekly load volume, and delivery flows between states.

## Acceptance criteria
- [x] Admin **Home** (`/admin`) replaces the placeholder with a dashboard (not a separate route)
- [x] Dashboard shows **user count** (all users) and **company count** (all companies)
- [x] A **bar chart** shows load count per week for loads whose **pickup date** falls from the Monday of the week containing “today minus four months” through the end of the current week (UTC); all customer companies; parent and child loads each count; weeks with no loads show zero
- [x] A **state delivery heat map** on **OpenStreetMap** (Leaflet) uses the same load window: heat intensity at pickup and delivery state centroids; brighter where more loads start or end; AU/NZ only; country-specific centroids so duplicate state codes (e.g. `TAS`) do not merge
- [x] `GET /api/admin/dashboard` returns the stats; admin-only (same middleware as other admin routes)
- [x] Loads without both collection and delivery addresses are omitted from the heatmap only

## Notes
- Admin portal shell: [US-004](US-004-authenticated-app-shell.md). Role and home path: [US-002](US-002-admin-portal-and-roles.md).
- Load dates and addresses: [US-024](US-024-customer-loads.md). Chart rendering uses Chart.js on the web app.
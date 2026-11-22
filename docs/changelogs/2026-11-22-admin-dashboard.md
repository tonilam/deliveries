# 2026-11-22 — Admin home dashboard

- New [US-025](../stories/US-025-admin-dashboard.md): admin **Home** shows user and company totals, a weekly loads bar chart (pickup date, last four months), and a from-state × to-state heatmap.
- API: `GET /api/admin/dashboard` returns counts, `loads_by_week`, and `state_flows` (admin only).
- Web: Chart.js bar chart on `AdminHome`; state volume shown with Leaflet + OpenStreetMap tiles and a `leaflet.heat` layer at state centroids (replaces the from×to table).
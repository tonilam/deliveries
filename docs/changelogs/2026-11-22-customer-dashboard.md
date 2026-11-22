# 2026-11-22 — Customer dashboard

- New [US-026](../stories/US-026-customer-dashboard.md): customer **Dashboard** (`/app`) shows top-5 counterparties (by company type) and a bar chart of loads **this week** and **next week** by pickup date.
- API: `GET /api/dashboard` returns `company_type`, `top_customers`, `top_providers`, and `loads_by_date` (one row per day this week and next week; customer with company only).
- Web: rankings panels and Chart.js daily pickup-date line chart on `CustomerDashboard`.
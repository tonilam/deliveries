# 2026-11-21 — Customer address list mobile view

- Updated [US-010](../stories/US-010-customer-address-management.md): on viewports **720px** or narrower, the Addresses list uses a **data list** (title, one line per column, Edit/Delete actions) with **search** and **sort by** instead of AG Grid.
- API `GET /api/addresses` accepts optional `search` (contains across type labels and text columns) with server pagination.
- Added project skill [table-responsive](../.cursor/skills/table-responsive/SKILL.md) and shared `app-data-list` for other grid pages later.
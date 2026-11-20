# 2026-11-21 — Customer address list pagination, filtering, and sorting

- Updated [US-010](../stories/US-010-customer-address-management.md): Addresses list is server-paginated, server-filtered, and server-sorted (same behaviour as companies).
- API `GET /api/addresses` accepts `page` / `per_page` (default 25; allowed 10, 25, 50, 100, 200), optional `sort` / `direction` (`type`, `business_name`, `address`, `zone`, `state`, `postcode`; defaults `business_name` / `asc`), and optional column `filter` params; returns pagination `meta` for the filtered set.
- Web Addresses page shows range/total, page size selector, and previous/next; grid uses auto height so the full current page is visible.

# Customer load activity timeline

- Activity log for delivery loads (create, update, delete, item assign/unassign/move, child loads) with customer-visible timeline on edit, X Dock modal, and desktop Deliveries **Activity**.
- `GET /api/loads/{load}/activity` with company scoping; impersonation shows customer causer and admin in `via` context.
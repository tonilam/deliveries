# Customer load activity

## Story
As a customer user, I want a timeline of what changed on a load and who did it, so that I can see the history of that delivery without asking someone else.

## Acceptance criteria
- [ ] On a load the company can already open, the customer sees a newest-first timeline of activity for that load
- [ ] A direct load’s timeline includes its own changes and activity on its Add Drop and X Dock children (create, update, delete) and item assign, unassign, and move that touch this load or those children
- [ ] An Add Drop or X Dock timeline includes that child load’s own changes and item assign, unassign, and move for that child
- [ ] Each entry shows when it happened, the user who did it, a short description, and the old and new values for fields that changed
- [ ] Logged load changes: create, update (only fields that changed), and delete. Child create, update, and delete are logged. Item assign, unassign, and move are logged when they change which load an item is on
- [ ] While an admin is impersonating, the entry shows the customer who is signed in and the admin who is impersonating
- [ ] `GET /api/loads/{load}/activity` is customer-only and company-scoped: guest **401**, admin or customer with no company **403**, another company’s load **404**, same as other customer load routes
- [ ] The timeline is on the delivery edit page (`/app/deliveries/:id/edit` for direct and Add Drop) and in the X Dock edit modal. On the desktop Deliveries grid, **Activity** opens the same timeline. The compact deliveries list (≤720px) keeps its three actions (Edit, Manage items, Delete)
- [ ] There is no global activity page and no activity timeline for addresses, companies, items, or admin screens

## Notes
- Load planning behaviour stays in [US-024](US-024-customer-loads.md). This story does not change those criteria.
- Items stay in [US-023](US-023-customer-delivery-items.md). Editing an item’s goods type, weight, or references is not a load activity. Creating an item with a load, or deleting an item that is on a load, is.
- Impersonation: [US-009](US-009-admin-impersonate-customer.md).
- Loads created before this story have an empty timeline. Do not backfill.
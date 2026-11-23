# Customer vehicle assignment activity

## Story
As a customer user, I want a log of when my company turns vehicle body types on or off, and who did it, so that I can see that history without asking someone else.

## Acceptance criteria
- [x] Activating or deactivating a body type for the signed-in user’s company writes one activity entry. Repeating the same active state does not write another entry. A failed toggle (including a soft-deleted body type, 404) writes nothing
- [x] Each entry records when it happened, the customer who did it, whether the type was activated or deactivated, and the body type identity stored at that time (id, name, code, category name)
- [x] While an admin is impersonating, the entry shows the customer who is signed in and the admin who is impersonating
- [x] `GET /api/vehicles/activity` is customer-only and limited to the caller’s company, newest first: guest **401**, admin or a customer with no company **403**. Another company’s entries are not returned
- [x] On `/app/vehicles`, desktop and compact, an **Activity** control opens that timeline. The compact list keeps its single row action (Activate or Deactivate)
- [x] There is still no global activity page and no activity timeline on addresses, companies, items, or admin screens. Admin catalogue edits are not logged here
- [x] Assignments made before this story have an empty timeline. Do not backfill

## Notes
- Activation behaviour stays in [US-027](US-027-customer-vehicles.md). This story does not change those criteria.
- Load activity stays in [US-028](US-028-customer-load-activity.md). This story does not change that story. Use a separate activity log name so load timelines never include these rows.
- Impersonation: [US-009](US-009-admin-impersonate-customer.md).

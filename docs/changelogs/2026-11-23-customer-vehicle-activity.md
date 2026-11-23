# Customer vehicle assignment activity

- Story: [US-030](../stories/US-030-customer-vehicle-activity.md).
- Activity log name `company_vehicles` when a customer activates or deactivates a body type for their company. `GET /api/vehicles/activity` is company-scoped, newest first.
- Web: `/app/vehicles` header **Activity** opens that timeline on desktop and compact. Compact list row actions stay Activate or Deactivate.

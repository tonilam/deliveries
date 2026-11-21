---
name: mutation-toastr
description: >-
  Wire HTTP mutation callbacks in apps/web to ToastrService for success and
  error feedback. Use when adding or changing POST, PUT, PATCH, or DELETE
  handlers, save/update/delete flows, form submit, or when the user asks for
  toastr, toast, or success/error notifications on API requests.
---

# Mutation request → toastr

Every **persisting** HTTP call in `apps/web` should give the user a toast on success and on API failure. Do not add a new toast library; use the app’s `ToastrService` and the global `ToastrHost` (already on `app-root`).

## In scope

| Method | Toast on success | Toast on error |
|--------|------------------|----------------|
| `POST` (create) | Yes | Yes |
| `PUT` / `PATCH` (update) | Yes | Yes |
| `DELETE` | Yes | Yes |

## Out of scope

- `GET` / list loads (keep page-level `error` signal only)
- Login, logout, SSO redirect, CSRF cookie fetch
- Pre-save checks (e.g. `check-uniqueness`) that do not persist
- Client-only validation (`form.invalid` → no toast)

## Setup (once per app)

Already in place:

- `apps/web/src/app/core/feedback/toastr.service.ts`
- `apps/web/src/app/core/feedback/toastr-host.ts` → `<app-toastr-host />` in `app.html`

Only add the host if missing.

## Per-component pattern

1. `private readonly toastr = inject(ToastrService);`
2. Import from `../../../core/feedback/toastr.service` (adjust depth).
3. In the mutation `subscribe` (or `pipe` `tap`—prefer explicit `next` / `error` in existing code):

**Success** — short, specific, past tense:

```ts
this.toastr.success('Address created.'); // or 'Address updated.' when editing
```

**Error** — reuse the same string shown inline (if any):

```ts
const message = this.firstError(err) ?? 'Could not save address';
this.error.set(message);
this.toastr.error(message);
```

4. Keep `submitting` / `deleting` signals and **inline** `error()` for forms unless the user asks to remove them; toasts complement inline errors.
5. Prefer **toastr over inline success banners** for “saved successfully” (remove redundant `financeSuccess`-style signals when adding toasts).

## Messages

- **Create**: `{Entity} created.`
- **Update**: `{Entity} updated.` or `{Entity} saved.` when the UI says “Save”
- **Delete**: `{Entity} deleted.` (or domain wording, e.g. `Company removed from network.`)
- **Side effects**: `Invitation sent.`, `Password updated.`, `Feature enabled.` / `Feature disabled.`
- **Errors**: Laravel-style payload — prefer first validation message via existing `firstError()` helpers, else `err.error?.message`, else a clear fallback (`Could not save address`).

## CSRF

Mutations that already use `this.auth.ensureCsrf().pipe(switchMap(() => request$))` stay unchanged; add toasts only inside `subscribe` `next` / `error`.

## Checklist for new or touched mutation code

```
- [ ] ToastrService injected
- [ ] success() in next handler after state updates
- [ ] error() in error handler with same message as inline error
- [ ] No toast on GET or auth-only navigation
- [ ] Message names the entity/action clearly
```

## Example (form save)

See `apps/web/src/app/pages/customer/addresses/address-form.ts` (`submit()`).

## Future

When `truckit-component-library` is installed, check Storybook for an official toast/notification component. Until then, keep using `ToastrService` so behavior stays consistent app-wide.
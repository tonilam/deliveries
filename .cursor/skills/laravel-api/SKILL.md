---
name: laravel-api
description: >-
  Apply loadplanner Laravel API conventions before adding or changing endpoints
  in apps/api. Use when developing the API, controllers, Form Requests,
  policies, route model binding, JSON payloads, validation, or authorization
  under apps/api.
---

# Laravel API conventions

Think through these before writing a new endpoint in `apps/api`. Match existing patterns; do not invent a parallel style.

## Controllers

- One invokable controller per route (`__invoke`).
- Controllers orchestrate: call the Form Request, persist, return JSON.
- Do not put domain validation or `abort()` checks in controllers.

## Form Requests

- Every mutating route, and every admin show/list/delete route, takes a Form Request.
- Admin routes with no extra rules extend or use `App\Http\Requests\Admin\AdminRequest` (`authorize` = admin role).
- Input shape lives in `rules()`.
- Cross-field and domain rules (network link, feature key, uniqueness) live in `withValidator()` / `prepareForValidation()`, not a private controller method.
- Return `422` via the validator. Use `NotFoundHttpException` only when the resource key itself is unknown (unknown feature key).

## Authorization

- Customer-owned resources use policies: `AddressPolicy`, `RateCardPolicy`, `CompanyPolicy` (network abilities: `viewAnyNetwork`, `createNetwork`, `viewNetwork`, `updateNetwork`, `deleteNetwork`).
- Form Request `authorize()` calls `$this->user()?->can(...)`.
- Do not `abort()` inside `authorize()` or authorization traits. Missing or out-of-tenant models 404 via route binding.
- `AuthorizesNetworkCompany` is only for `ownCompany()` (loading the caller's company). It is not an authorization layer.

## Route model binding

- Admin nested routes use `scopeBindings()` on the admin group (`vehicle-categories` → body types → options, `countries` → states). Do not re-check parent foreign keys in controllers.
- Customer tenant scoping is in `App\Routing\RouteBindingRegistrar` (`address`, `rateCard`, and `api/network/companies/{id}`). New customer-owned models that must hide other tenants belong there, not in a trait that aborts.
- Register new bindings in `RouteBindingRegistrar::register()` from `AppServiceProvider`.

## JSON responses

- Do not return Eloquent models directly.
- Add a payload method on the model and use it: `toAuthPayload()`, `toAdminPayload()`, `toCustomerPayload()`, `toOptionPayload()`.
- Select only needed columns when a list is a small option set (`CountryOptionsController`).

## Health

- The only health endpoint is `GET /api/health` (`HealthController`). It reports service status and database connectivity.
- Do not add a second health route or re-enable framework `/up`.

## Domain checks already encoded

- Rate card `company_ids` must be network children of the caller's company with `company_type` matching `user_type` (`ValidatesRateCardPayload`). Tests must use `Company::factory()->forNetworkOf(...)`.
- Admin company network link rules live on `LinkAdminCompanyNetworkRequest`.

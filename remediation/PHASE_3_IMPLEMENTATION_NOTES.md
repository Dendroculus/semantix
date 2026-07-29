# Phase 3 Implementation Notes

## Maintainer decision

Option A, global-admin-only metrics, is selected.

The existing runtime metrics collector is process-global and has no
namespace-aware data model. Restricting `/api/v1/metrics` to an authenticated
`admin` principal with `namespaces:["*"]` closes `SEC-001` without presenting
partially scoped counters as tenant-isolated data. Authentication-disabled
local development retains access through its existing global administrator
principal.

## Authorization contract

- Scoped viewers receive `403 Forbidden`.
- Scoped operators receive `403 Forbidden`.
- Namespace administrators receive `403 Forbidden`.
- Global administrators receive the existing process-wide snapshot unchanged.
- Unauthenticated requests receive `401 Unauthorized` when token
  authentication is enabled.
- `/api/v1/cache/stats` remains namespace-aware and unchanged.

Activity in one namespace is never returned to a scoped principal through the
metrics endpoint because scoped principals cannot access that global surface.
Namespace users can continue to inspect their authorized cache statistics
through `/api/v1/cache/stats`.

## Frontend behavior

The Observability navigation item is shown only when authentication is
disabled or the authenticated session is a global administrator. A scoped
principal opening a saved `/observability` URL receives an access explanation
and a link to the namespace-aware cache inspector; the metrics API is not
called.

This is an intentional authorization tightening for token-authenticated
deployments. It does not change the metrics response schema, collector
behavior, or local-development workflow.

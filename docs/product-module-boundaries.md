# Product Module Boundaries

AIHQ product modules own product and runtime behavior inside the modular
monolith. They depend on platform core for shared control-plane capabilities
instead of rebuilding tenant, auth, billing, quota, audit, channel, or runtime
authority foundations.

This document is an architecture contract for product/runtime module ownership.
It does not extract services, rename folders, change routes, or change runtime
behavior.

## Contract

Product modules own the domain logic for a product surface or runtime:

- inbox and conversation runtime
- voice runtime
- comments runtime
- website widget runtime
- content and image runtime
- source sync and crawler runtime
- future apps

Each module should expose reusable route-free APIs for its domain. Routes remain
HTTP adapters that call module or platform functions.

## Current Module State

Current route-free module boundaries include:

- `ai-hq-backend/src/modules/inbox`
- `ai-hq-backend/src/modules/comments`
- `ai-hq-backend/src/modules/voice`

Other product/runtime areas may still live under `src/services` or `src/routes`
until their boundaries are created. Ownership decisions should follow this
contract even before files move.

## Module Responsibilities

Product modules should own:

- runtime-specific repositories and data access wrappers
- runtime mutations and state transitions
- product-specific policy interpretation
- product-specific orchestration that is not HTTP-specific
- product-specific durable job logic
- runtime adapter helpers for inbox, voice, comments, widget, content, or source
  sync behavior

Product modules should not own:

- tenant identity
- auth/session identity
- workspace ownership
- billing, commercial plans, usage, or quotas
- global roles and permissions
- business truth authority
- runtime projection authority
- shared channel registry and integration ownership
- secrets policy
- global audit, event, job, and DB foundations

Those belong to platform core. See
[Platform Core Contract](./platform-core-contract.md).

Voice ownership has an additional contract. See
[Voice Module Contract](./voice-module-contract.md).

## Route Boundary

Routes must remain stable HTTP adapters.

- Do not change route paths as part of module boundary work.
- Do not move route registrations unless the PR is explicitly a route split.
- Do not put reusable product logic back into route files.
- Do not import route files from `src/modules/**` or `src/services/**`.
- If a route file still contains reusable logic, extract the route-free helper
  first, then update callers.

## Service Boundary

`src/services` may still contain platform-adjacent or runtime-adjacent code.
When touched:

- move route-free reusable product logic behind `src/modules/<domain>` when it
  belongs to one product runtime
- move route-free shared control-plane logic behind platform core when it must
  be reused across products
- keep infrastructure primitives in `src/db`, `src/utils`, `src/realtime`, and
  appropriate service helpers until a cleaner facade exists

## Future Extraction

Future extraction targets may include:

- conversation-runtime or inbox-runtime
- voice-runtime
- comments-runtime
- website-widget-runtime
- source-sync-runtime
- content-runtime

Extraction must happen only after module boundaries are stable inside the
monolith. Route paths, API contracts, and platform foundations should remain
stable through extraction.

Voice extraction readiness should follow the
[Voice Module Contract](./voice-module-contract.md) before any service split.

## Non-Goals

- Do not extract services yet.
- Do not rename folders, repositories, services, or package names yet.
- Do not duplicate platform core foundations inside product modules.
- Do not treat production readiness docs as architecture contracts. They are
  launch gates and release evidence.

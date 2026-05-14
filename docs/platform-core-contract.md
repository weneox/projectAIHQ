# Platform Core Contract

AIHQ is currently a modular monolith. `ai-hq-backend` remains the platform
control-plane backend while product and runtime domains are separated behind
in-repo module boundaries.

This document is an architecture contract. It is not a production launch gate,
deployment checklist, or service extraction plan.

## Contract

Platform core owns shared, reusable control-plane capabilities that every
product module and future app must use instead of rebuilding locally.

Platform core must provide one canonical path for:

- tenancy and tenant context
- auth and session identity
- workspace ownership and workspace setup state
- roles, permissions, and operational write access
- billing, commercial plan, entitlement, and quota hooks
- usage metering and quota decisions
- audit, events, jobs, and durable execution primitives
- business truth and approved runtime authority
- runtime projection and launch readiness state
- channels and integration registry
- tenant provider secrets and secrets policy
- operational readiness and launch posture

Platform core must stay reusable across inbox, voice, comments, website widget,
content, source sync, and future app modules.

## Current Location

The current platform/control-plane boundary is represented by:

- `ai-hq-backend/src/platform`
- route-free platform-adjacent helpers in `ai-hq-backend/src/services`
- shared infrastructure in `ai-hq-backend/src/db`, `src/utils`, and `src/realtime`

Not every platform capability already lives under `src/platform`. Some mature
platform capabilities still live under `src/services` or `src/db/helpers`.
Ownership should follow this contract before files are moved.

## Import Rules

- `src/platform/**` must not import from `src/routes/**`.
- `src/platform/**` must not import from `src/modules/**`.
- `src/platform/**` may import from `src/db/**`, `src/services/**`, and
  `src/utils/**` while platform helpers are still being consolidated.
- Product modules may import platform core helpers.
- Routes may import platform core helpers as HTTP adapters.

These rules are enforced for platform and modules by:

```bash
npm --prefix "./ai-hq-backend" run lint:boundaries
```

The broader service-to-route guard is covered by:

```bash
node --import ./scripts/workspace-module-loader.mjs --test --test-concurrency=1 ./ai-hq-backend/tests/service-route-dependency-regression.test.js
```

## Ownership Decisions

When ownership is unclear, choose platform core if the capability is:

- needed by more than one product module
- required before a tenant can safely run any runtime surface
- related to tenant identity, access, billing, quota, audit, truth, readiness,
  integrations, or secrets
- a control-plane decision rather than a product interaction

Choose a product module if the capability is:

- specific to one runtime surface
- tied to a conversation, voice call, comment, widget session, content task, or
  source sync run
- safe to extract with that product runtime later

## Future Apps

Future apps must reuse platform core for tenant, auth, workspace, billing,
quota, audit, DB foundations, runtime authority, channel registry, and secrets.

Future apps must not create duplicate tenant systems, billing systems,
workspace systems, or runtime authority systems.

## Non-Goals

- Do not extract services yet.
- Do not rename folders, repositories, or package names yet.
- Do not change route paths as part of boundary work.
- Do not move runtime logic into platform core.
- Do not treat production readiness docs as architecture contracts. They remain
  launch gates and release evidence.

# Backend Module Boundaries

Project AIHQ is currently built as a modular monolith. `ai-hq-backend` is the
control-plane backend for the platform while the runtime domains are being
separated behind explicit in-repo boundaries.

The goal is not to extract services yet. Folder names, backend names, and route
surfaces should stay stable until the module boundaries are proven.

## Current Backend Shape

- `ai-hq-backend/src/platform` is the shared platform and control-plane
  boundary.
- `ai-hq-backend/src/modules` contains domain and runtime modules inside the
  modular monolith.
- `ai-hq-backend/src/routes` contains HTTP adapters only.

Routes translate HTTP requests into module or platform calls. Domain logic and
shared platform logic should live outside `src/routes`.

## Import Rules

- `src/routes/**` may import from `src/modules/**` and `src/platform/**`.
- `src/modules/**` may import from `src/platform/**`, `src/db/**`,
  `src/services/**`, and `src/utils/**`.
- `src/modules/**` must not import from `src/routes/**`.
- `src/platform/**` may import from `src/db/**`, `src/services/**`, and
  `src/utils/**` for now.
- `src/platform/**` must not import from `src/routes/**`.
- `src/platform/**` must not import from `src/modules/**`.

These rules keep route-layer concerns out of reusable domain and platform
boundaries.

## Boundary Guard

The backend import boundary is enforced by:

```bash
ai-hq-backend/scripts/check-module-boundaries.mjs
```

Run it directly with:

```bash
npm --prefix "./ai-hq-backend" run lint:boundaries
```

The standard backend lint command also runs the boundary guard:

```bash
npm --prefix "./ai-hq-backend" run lint
```

`lint` runs the existing syntax check first, then `lint:boundaries`.

## Inbox Phase 1

The first inbox modular-monolith pass is complete. The following inbox pieces
now live behind `src/modules/inbox` boundaries:

- repository
- internal helpers
- mutations
- avatar helper logic
- ingest and outbound handlers
- operator helpers

The route files under `src/routes/api/inbox` should remain HTTP adapters that
delegate into module code.

## Future Extraction Targets

Future runtime extraction may happen after the module boundaries are stable.
Expected targets include:

- conversation-runtime or inbox-runtime
- voice-runtime
- source-sync-runtime
- content-runtime

Do not rename folders, repositories, or services yet. Extraction should happen
only after the modular boundaries have stayed stable and the existing route
adapters can remain thin compatibility surfaces.

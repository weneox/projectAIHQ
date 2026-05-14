# Voice Module Contract

AIHQ voice remains a product/runtime module inside the `ai-hq-backend`
modular monolith. This contract documents ownership before any further code
movement.

This is a docs-first contract. It does not change runtime behavior, route
paths, DB schema, frontend endpoints, Twilio sidecar behavior, package names,
or service boundaries.

## Current State

- `twilio-voice-backend` is the Twilio provider sidecar.
- `ai-hq-backend/src/routes/api/voice/*` are HTTP adapters.
- `ai-hq-backend/src/services/voiceInternalRuntime.js` currently owns too much
  voice orchestration and should be split only after route-free module
  contracts are clear.
- `ai-hq-backend/src/modules/voice/*` is already the started route-free voice
  module boundary:
  - `config.js`
  - `mutations.js`
  - `repository.js`
  - `runtime.js`
  - `shared.js`
- `shared-contracts` owns request and response validation between the Twilio
  sidecar and AIHQ backend.

## Target Architecture

`ai-hq-backend` owns:

- platform core
- voice module brain
- DB source of truth
- tenant, auth, runtime authority, business truth, quota, audit, and readiness
  foundations

`twilio-voice-backend` owns:

- Twilio provider sidecar behavior
- Twilio signature validation
- TwiML responses
- `/twilio/stream` websocket
- OpenAI realtime bridge
- provider-specific transfer and fallback mechanics
- internal API calls to AIHQ backend through `shared-contracts`

Voice is being prepared for future extraction only after the module boundary is
stable. Do not move all voice logic into `twilio-voice-backend` now.

## Ownership

### Platform Core Owns

Platform core owns reusable control-plane foundations:

- tenant identity
- auth and session identity
- workspace, roles, and permissions
- billing and commercial plan hooks
- usage and quota decisions
- audit, events, and jobs foundation
- business truth authority
- runtime projection authority
- channel and integration registry
- tenant provider secrets policy
- operational readiness and launch posture

Voice must reuse platform core for these capabilities. It must not duplicate
tenant, auth, billing, quota, DB foundations, runtime authority, or business
truth systems.

### Voice Module Owns

The voice module owns route-free voice product/runtime behavior:

- voice call and session state logic
- voice call and session mutations
- voice config shaping from approved runtime
- voice transcript handling
- voice operator join, end, and takeover domain logic
- voice event and replay payload shaping
- voice-specific runtime policy interpretation
- voice-specific route-free repositories and helpers

The voice module may use shared platform, DB, utility, realtime, and service
helpers when those helpers are route-free.

### Voice Routes Own

`ai-hq-backend/src/routes/api/voice/*` owns HTTP adapter behavior:

- request parsing
- response shaping
- route registration
- auth middleware wiring
- adapter calls into platform and voice module helpers

Routes must not be treated as reusable domain or runtime helpers.

### Twilio Sidecar Owns

`twilio-voice-backend` owns provider-specific behavior:

- Twilio webhook signature validation
- TwiML generation
- Twilio stream websocket upgrade
- OpenAI realtime bridge
- Twilio transfer and fallback mechanics
- provider-specific environment validation
- calling AIHQ internal APIs through `shared-contracts`

The sidecar must not own platform logic. It must not duplicate tenant, auth,
billing, quota, business truth, runtime projection, or DB source-of-truth
systems.

### Shared Contracts Owns

`shared-contracts` owns validation contracts shared between the sidecar and
AIHQ backend:

- request shapes
- response shapes
- health and runtime contracts
- auth and internal operation contracts

Use shared contracts to keep sidecar and backend integrations explicit.

## Import Rules

- `src/modules/voice/**` must not import from `src/routes/**`.
- `src/services/**` must not import from `src/routes/**`.
- `src/routes/api/voice/**` may import from `src/modules/voice/**` and
  platform helpers.
- `twilio-voice-backend` should call AIHQ backend through internal APIs and
  `shared-contracts`, not by importing backend source files.
- Platform core must not depend on the voice module.

## Recommended PR Sequence

1. Add `docs/voice-module-contract.md`.
2. Add module facades only:
   - `ai-hq-backend/src/modules/voice/index.js`
   - `ai-hq-backend/src/modules/voice/internal/index.js`
3. Move route-free voice public read helpers out of
   `ai-hq-backend/src/routes/api/voice/public.js`.
4. Move operator voice mutation domain logic out of the public route file.
5. Split `ai-hq-backend/src/services/voiceInternalRuntime.js` into smaller
   route-free voice module orchestration files.
6. Clean Twilio sidecar mojibake and encoding strings without behavior changes.
7. Add or strengthen voice contract tests.

Each PR should keep route paths, DB schema, frontend endpoints, runtime
responses, package names, and service boundaries stable unless explicitly
approved in a later extraction plan.

## Non-Goals

- Do not extract voice into a separate service yet.
- Do not move platform logic into `twilio-voice-backend`.
- Do not duplicate tenant, auth, billing, quota, runtime authority, or business
  truth inside voice.
- Do not recreate existing voice module files.
- Do not change Twilio/SIP/realtime behavior.
- Do not change DB schema.
- Do not change route paths.
- Do not change frontend endpoints.

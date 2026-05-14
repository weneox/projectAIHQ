# Backend Service Ownership Audit

Date: 2026-05-14

This audit covers `ai-hq-backend/src/services`, `src/utils`, `src/db`,
`src/platform`, `src/modules`, and `src/routes` after the platform and inbox
modular-monolith boundary work.

This is an ownership audit only. It does not recommend moving files in this PR.
The current priority is to document likely owners, identify route-layer import
risks, and keep extraction decisions staged behind stable module boundaries.

## Executive Summary

- `src/platform` is now a clean control-plane boundary for tenancy, workspace,
  business truth, agents, channels, audit, events, jobs, source sync, and usage.
- `src/modules` currently contains the inbox module boundary. It does not import
  from `src/routes`.
- `src/routes/api/inbox` is now mostly route adapters. The large operator
  handler has been split into direct route registration groups, and legacy
  route compatibility exports are gone.
- `src/db` and `src/utils` are broadly shared infrastructure. They should not be
  swept into modules by default.
- The biggest remaining ownership risk is `src/services` importing route-layer
  code. These imports are existing coupling points and should be handled with
  future boundary PRs, not changed during this audit.

## Ownership Buckets

### 1. Platform / Control Plane Candidates

| Current path | Current responsibility | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `ai-hq-backend/src/platform/tenancy` | Canonical tenant context resolution, request tenant trust rules, tenant repository wrappers. | platform | P0 | Keep as platform authority. Continue blocking platform-to-routes and platform-to-modules imports. | No |
| `ai-hq-backend/src/platform/workspace` | Workspace settings facade over existing helpers. | platform | P1 | Keep as control-plane facade. Future work can move more workspace service APIs behind this boundary. | No |
| `ai-hq-backend/src/platform/businessTruth` | Platform-safe business truth facade. | platform | P1 | Keep wrapping existing truth systems. Avoid duplicating truth state. | No |
| `ai-hq-backend/src/platform/agents` | Agent/template settings facade. | platform | P1 | Keep wrapping existing tenant agent config helpers. | No |
| `ai-hq-backend/src/platform/channels` | Tenant channel facade and route-free channel data boundary. | platform | P1 | Keep route-free. Future channel connect helpers should move behind platform or module-safe data helpers. | No |
| `ai-hq-backend/src/platform/audit`, `src/platform/events`, `src/platform/jobs` | Shared audit, event, and job facades. | platform | P2 | Keep as platform/control-plane primitives. Consider expanding route adapters to depend on these instead of low-level helpers. | No |
| `ai-hq-backend/src/platform/usage` | Usage/quota platform facade. | platform | P2 | Keep as control-plane boundary. Align with `services/tenantQuota.js` over time. | No |
| `ai-hq-backend/src/services/auth/*` | Canonical user access, email verification, self-service workspace creation. | platform | P1 | Move route-layer dependencies to platform/db helpers first, then consider exposing platform auth/workspace APIs. | No |
| `ai-hq-backend/src/services/workspace/**` | Workspace setup, import, review, mutations, readiness, post-auth workspace flows. | platform | P1 | Keep in services for now. Future platform workspace boundary can wrap these APIs incrementally. | No |
| `ai-hq-backend/src/services/businessBrain/**`, `src/services/projectedRuntime/**`, `src/services/projectedTenantRuntime.js` | Runtime projection, tenant runtime authority, catalog and control-plane runtime shape. | platform | P1 | Treat as platform/control-plane runtime projection, not an inbox module. Future work can create platform facade APIs around the current services. | No |
| `ai-hq-backend/src/services/businessTruthAnswer/**` | Business truth answer composition, retrieval, localization, validation. | platform | P2 | Likely platform/business-truth adjacent. Keep shared until callers and runtime ownership are clearer. | No |
| `ai-hq-backend/src/services/tenantEntitlements.js`, `tenantProviderSecrets.js`, `tenantQuota.js`, `commercialPlans.js` | Entitlements, secrets, quota, and plan logic. | platform | P1 | Keep shared platform services. Split HTTP middleware wrappers from quota/entitlement core when touched. | No |
| `ai-hq-backend/src/services/operationalChannels.js`, `operationalReadiness.js`, `launch/posture.js` | Launch and operational readiness surfaces. | platform | P2 | Keep platform/control-plane. Remove route imports before considering ownership moves. | No |

### 2. Module / Runtime Candidates

| Current path | Current responsibility | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `ai-hq-backend/src/modules/inbox/**` | Inbox repository, mutations, avatar logic, operator helpers, internal ingest/outbound/runtime helpers. | module | P0 | Keep as the inbox/conversation module boundary. Continue using route adapters for HTTP registration. | No |
| `ai-hq-backend/src/services/inboxBrain/**`, `src/services/inboxPolicy.js` | Inbox reply behavior, prompts, conversation engine, handoff and policy logic. | module | P1 | Candidate to move behind `src/modules/inbox` or future conversation runtime after route/service imports are clean. | No |
| `ai-hq-backend/src/services/commentBrain/**`, `src/services/commentBrain.js` | Comment reply/runtime logic. | module | P2 | Candidate for future inbox/comments runtime. First isolate comment route repository and handler helper dependencies. | No |
| `ai-hq-backend/src/services/voiceInternalRuntime.js`, `voiceReplayTrace.js` | Voice runtime state processing and replay trace. | module | P1 | Candidate for future voice runtime. First extract voice route data/config helpers out of `src/routes/api/voice`. | No |
| `ai-hq-backend/src/services/sourceSync/**`, `src/services/sourceFusion/**` | Crawlers, extraction, source sync orchestration, source fusion and synthesis. | module | P2 | Candidate for future source-sync runtime. Keep shared until source-sync boundary is defined. | No |
| `ai-hq-backend/src/services/contentBehaviorRuntime.js`, `src/services/media/**`, `src/services/togetherImage.js` | Content, image, video, media execution providers. | module | P2 | Candidate for future content runtime. Keep provider clients in services until module boundary exists. | No |
| `ai-hq-backend/src/routes/api/websiteWidget/**` plus website-widget-facing service calls | Website widget public runtime surface and install/config logic. | module or route adapter | P2 | Treat route files as adapters. Runtime logic that is not HTTP-specific can later move to a website widget module or inbox runtime extension. | No |
| `ai-hq-backend/src/services/channelDelivery.js`, `metaGatewayClient.js` | Channel outbound delivery and Meta gateway calls. | module or infrastructure | P1 | Delivery orchestration likely belongs with runtime modules; provider HTTP clients may remain infrastructure. Telegram delivery config now uses a route-free platform channel helper. | No |

### 3. Infrastructure / Shared Utilities

| Current path | Current responsibility | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `ai-hq-backend/src/db/index.js`, `runSchemaMigrations.js`, `src/db/schema/**` | Database connection and schema/migration execution. | infrastructure | P0 | Keep shared infrastructure. Do not move into modules. | No |
| `ai-hq-backend/src/db/helpers/**` | Shared table-specific data helpers for tenants, settings, knowledge, runtime projections, usage, external idempotency, jobs, audit, content, voice. | infrastructure | P1 | Keep shared. Domain-specific helpers may later get thin platform/module facades, but DB helpers can remain central. | No |
| `ai-hq-backend/src/db/tenantContext.js` | Tenant scoped DB context and guard helpers, including request-context extraction. | infrastructure | P1 | Keep shared. Consider isolating request-to-context adapter from pure tenant context helpers later. | No |
| `ai-hq-backend/src/utils/http.js`, `apiResponse.js`, `apiVersioning.js` | HTTP response helpers and middleware utilities. | infrastructure | P1 | Keep as HTTP infrastructure. Use only in route adapters or explicit handler factories. | No |
| `ai-hq-backend/src/utils/auth.js`, `adminAuth.js`, `roles.js` | Auth token validation, admin auth, role helpers, request guards. | infrastructure or platform | P1 | Keep shared for now. Platform auth can wrap stable pieces later. | No |
| `ai-hq-backend/src/utils/rateLimit.js` | Rate limiting middleware and helpers. | infrastructure | P1 | Keep shared infrastructure. | No |
| `ai-hq-backend/src/utils/logger.js`, `auditLog.js`, `buildInfo.js` | Logging, request IDs, audit writer, build headers. | infrastructure | P1 | Keep shared infrastructure. | No |
| `ai-hq-backend/src/utils/textFix.js`, `url.js`, `publicFetchSafety.js`, `idempotency.js` | Pure normalization, URL safety, fetch safety, idempotency keys. | infrastructure | P1 | Keep shared and route-free. | No |
| `ai-hq-backend/src/services/queue.js`, `asyncTasks.js`, `durableExecutionCore.js` | Queue and execution primitives. | infrastructure | P2 | Keep shared until durable execution service dependencies are untangled from route handlers. | No |
| `ai-hq-backend/src/realtime/**`, `src/services/pushBroadcast.js`, `src/utils/push.js` | Realtime and push transport. | infrastructure | P2 | Keep shared transport. Domain modules should call transport through adapters or platform event facades. | No |

## Risky Mixed Files

| Current path | Current responsibility | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `ai-hq-backend/src/services/durableExecutionService.js` | Durable execution dispatcher that also imports comment route repository/state/shared helpers and a comment ingest handler. | infrastructure with module adapters | P1 | Extract comment route data/helper dependencies behind a comment module or service-level adapter. Keep durable execution as infrastructure orchestration. | No |
| `ai-hq-backend/src/services/voiceInternalRuntime.js` | Voice runtime processing that imports voice route config, mutations, repository, utils, and shared helpers. | module | P1 | Create a route-free voice data/config boundary before any voice runtime extraction. | No |
| `ai-hq-backend/src/services/channelDelivery.js` | Channel outbound delivery using route-free platform channel helpers for Telegram delivery config. | module or infrastructure | P1 | Continue evaluating ownership with future runtime boundaries; keep service-to-route imports out. | No |
| `ai-hq-backend/src/services/auth/selfServiceWorkspace.js` | Self-service workspace creation using route-free tenant key and tenant user helpers. | platform | P1 | Route dependency fixed. Future work can wrap this behind a broader platform auth/workspace boundary. | No |
| `ai-hq-backend/src/services/auth/canonicalUserAccess.js` | Canonical user access service that imports admin route DB timeout helper. | platform | P2 | Move `queryDbWithTimeout` to infrastructure/db utility and update route and service callers. | No |
| `ai-hq-backend/src/services/launch/posture.js` | Launch posture assembler that imports channel-connect route status functions and workspace route shared helper. | platform | P2 | Move route status readers into platform/channel or service helpers; keep launch posture platform-owned. | No |
| `ai-hq-backend/src/services/tenantQuota.js` | Quota service plus Express middleware behavior using `req` and `res`. | platform or infrastructure | P2 | Split quota decision/reservation core from HTTP middleware wrapper when touched. | No |
| `ai-hq-backend/src/services/workspace/setup/actorApp.js` | Workspace setup helper directly writes HTTP responses. | platform with route adapter wrapper | P2 | Separate response shaping from workspace actor decision logic. | No |
| `ai-hq-backend/src/modules/inbox/internal/ingest.js` | Inbox internal ingest handler factory that accepts `req`/`res` and performs runtime orchestration. | module with route-adapter edge | P2 | Keep for now because route adapter delegates to it. Later split pure ingest orchestration from HTTP handler wrapper if extraction needs it. | No |
| `ai-hq-backend/src/modules/inbox/internal/outbound.js` | Inbox internal outbound handler factory with request/response shaping and runtime orchestration. | module with route-adapter edge | P2 | Keep for now. Future split can produce pure outbound runtime function plus thin HTTP wrapper. | No |
| `ai-hq-backend/src/routes/api/websiteWidget/handlers.js` | Public widget route handlers with runtime decisions, persistence, rate limiting, domain verification, and realtime response shaping. | route adapter plus module candidate | P1 | Extract website widget runtime/persistence orchestration behind a module boundary before future extraction. | No |
| `ai-hq-backend/src/routes/api/channelConnect/website.js` | Channel settings/verification route plus website ingest persistence calls. | route adapter plus platform/channel candidate | P2 | Keep as adapter now. Future split should move channel status/data functions behind platform channel helpers. | No |

## Import Risk Audit

### Services Importing Routes

These are the current service-to-route dependencies found in `src/services`.
They do not currently violate the module boundary guard, but they are ownership
risks because route files should be HTTP adapters.

| Current path | Route-layer dependency | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `src/services/auth/canonicalUserAccess.js` | `routes/api/adminAuth/utils.js` | platform | P2 | Move shared DB timeout helper to `src/db` or `src/utils`. | No |
| `src/services/auth/selfServiceWorkspace.js` | `routes/api/team/repository.js`, `routes/api/tenants/utils.js` | platform | P1 | Move team repository and tenant key normalization to platform/db helpers. | No |
| `src/services/durableExecutionService.js` | `routes/api/comments/repository.js`, `routes/api/comments/state.js`, `routes/api/comments/handlers/shared.js`, `routes/api/comments/handlers/ingest.js` | infrastructure with comment module adapter | P1 | Establish comment/inbox runtime boundary before touching durable execution orchestration. | No |
| `src/services/launch/posture.js` | `routes/api/channelConnect/meta.js`, `telegram.js`, `website.js`, `routes/api/workspace/shared.js` | platform | P2 | Move status readers and workspace actor helper behind platform/service helpers. | No |
| `src/services/voiceInternalRuntime.js` | `routes/api/voice/config.js`, `mutations.js`, `repository.js`, `utils.js`, `shared.js` | module | P1 | Create voice module/data boundary before future voice runtime extraction. | No |

### Utils, DB, Platform, and Modules

| Area | Current finding | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `src/utils` importing `src/routes` | No route imports found. Some utilities are intentionally HTTP middleware (`auth`, `adminAuth`, `rateLimit`, `apiResponse`, `buildInfo`, `staticAssets`, `securitySurface`). | infrastructure | P1 | Keep shared. Avoid importing domain route handlers into utils. | No |
| `src/db` importing `src/routes` | No route imports found. | infrastructure | P0 | Keep DB helpers route-free. | No |
| `src/platform` importing `src/routes` | No route imports found; boundary guard covers platform-to-routes. | platform | P0 | Keep clean. | No |
| `src/platform` importing `src/modules` | No module imports found; boundary guard covers platform-to-modules. | platform | P0 | Keep clean. | No |
| `src/modules` importing `src/routes` | No route imports found; boundary guard covers modules-to-routes. | module | P0 | Keep clean. | No |

## Route Layer State

| Current path | Current responsibility | Recommended owner | Priority | Recommended future action | Move now |
| --- | --- | --- | --- | --- | --- |
| `ai-hq-backend/src/routes/api/inbox/handlers.js` | Route registration hub for inbox operator route groups. | route adapter | P0 | Keep thin. Do not add domain logic back. | No |
| `ai-hq-backend/src/routes/api/inbox/operator/*.js` | Real HTTP adapters for inbox operator endpoint groups. | route adapter | P0 | Keep direct route registration, not nested `r.use` groups. | No |
| `ai-hq-backend/src/routes/api/inbox/internal.js`, `src/routes/api/inbox/internal/index.js`, `internal/ingest.js`, `internal/outbound.js` | Internal inbox HTTP routes and adapters around module handlers. | route adapter | P1 | Keep as adapters. Runtime logic should stay or move into `src/modules/inbox/internal`. | No |
| `ai-hq-backend/src/routes/api/inbox/avatar.js` | Inbox avatar HTTP adapter. | route adapter | P1 | Keep as adapter using module avatar helpers. | No |
| Other `src/routes/api/**` domains | Mixed maturity. Several route folders still expose repository/helper logic used by services. | route adapter | P1 | When touching each domain, move reusable data/domain helpers out of routes before adding service dependencies. | No |

## Recommended Sequence

1. Keep the current boundary guard unchanged: it protects the most important
   rule, namely platform/modules must not depend on routes.
2. Add a future service-layer import guard only after deciding whether all
   `src/services -> src/routes` imports should be blocked or whether a temporary
   allowlist is needed.
3. Tackle high-risk route dependencies by domain:
   - voice route helpers used by `voiceInternalRuntime`
   - comments route helpers used by `durableExecutionService`
   - channel-connect route helpers used by launch posture
   - team/tenant route helpers used by auth workspace services
4. Do not move `src/db` or `src/utils` wholesale. They are shared
   infrastructure and should remain stable.
5. Do not extract services yet. Move only small route-free helpers behind
   platform/module boundaries as each domain is hardened.

## Verification Commands

Run these after future changes in this area:

```bash
npm --prefix "./ai-hq-backend" run lint:boundaries
npm --prefix "./ai-hq-backend" run lint
```

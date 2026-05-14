# Durable Execution Comments Dependency Audit

Date: 2026-05-14

Docs-only audit. No runtime, route, DB/schema, or frontend changes.

## Current problem

`ai-hq-backend/src/services/durableExecutionService.js` no longer imports comments route-layer files.

The comments route dependency allowlist entries have been removed from
`service-route-dependency-regression.test.js`.

## Classification

| Dependency | Used by durable execution | Type | Future owner | Priority |
| --- | --- | --- | --- | --- |
| `routes/api/comments/repository.js` | `getCommentById`, `updateCommentState` | route compatibility repository export | `src/modules/comments/repository.js` | Done |
| `routes/api/comments/state.js` | `mergeClassificationForReply`, `mergeClassificationForReplyPending` | pure/domain state helpers | `src/modules/comments/state.js` | Done |
| `routes/api/comments/handlers/shared.js` | `buildReplyRaw`, `buildReplyPendingRaw`, `emitCommentUpdatedRealtime` | mixed raw builders + realtime + route helpers | `src/modules/comments/shared.js` | Done |
| `routes/api/comments/handlers/ingest.js` | `processCommentWebhookJob` | worker orchestration mixed with HTTP handler | `src/modules/comments/ingestJob.js` | Done |

## Recommended staged sequence

1. Extract comment state helpers to `src/modules/comments/state.js`. Done in `refactor/comments-state-helpers`.
2. Update `durableExecutionService.js` to import state helpers from module.
3. Extract comments repository facade to `src/modules/comments/repository.js`. Done in `refactor/comments-repository-facade`.
4. Update `durableExecutionService.js` repository imports.
5. Extract reply raw builders and realtime helper to `src/modules/comments/shared.js`. Done in `refactor/comments-reply-shared-helpers`.
6. Update `durableExecutionService.js` shared imports.
7. Extract `processCommentWebhookJob` to `src/modules/comments/ingestJob.js`. Done in `refactor/comments-ingest-job-module`.
8. Remove all durableExecutionService comments route allowlist entries. Done in `refactor/comments-ingest-job-module`.

## Non-goals

- Do not move all comments route files at once.
- Do not rewrite comments ingestion.
- Do not change durable execution finality/retry behavior.
- Do not change routes, DB schema, frontend, or runtime behavior.
- Do not create a separate comments backend yet.

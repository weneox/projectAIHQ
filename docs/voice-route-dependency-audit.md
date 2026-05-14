# Voice Route Dependency Audit

Date: 2026-05-14

This is a documentation-only audit. No runtime, route, DB/schema, or frontend behavior changes.

## Current problem

`ai-hq-backend/src/services/voiceInternalRuntime.js` is a service/runtime file, but it imports from route-layer voice files:

- `routes/api/voice/config.js`
- `routes/api/voice/mutations.js`
- `routes/api/voice/repository.js`
- `routes/api/voice/utils.js`
- `routes/api/voice/shared.js`

Voice should not be extracted into a separate backend yet. First we need route-free module boundaries inside `ai-hq-backend`.

## Dependency classification

| Current path | Used responsibility | Classification | Future owner | Priority | Move now |
| --- | --- | --- | --- | --- | --- |
| `routes/api/voice/shared.js` | `s`, `b`, `isObj`, `normalizePhone`, `normalizeTranscriptItem` | mixed pure helper + HTTP route helpers | pure helpers to `src/modules/voice/shared.js`; HTTP helpers stay in routes | P1 | No |
| `routes/api/voice/repository.js` | `findTenantByKeyOrPhone`, voice DB re-exports, tenant scope helpers | mixed DB/data + request scope | route-free data helpers to `src/modules/voice/repository.js`; request scope stays route adapter | P1 | No |
| `routes/api/voice/config.js` | `buildVoiceConfigFromProjectedRuntime` | runtime config builder | `src/modules/voice/config.js` | P1 | No |
| `routes/api/voice/mutations.js` | `upsertCallAndSession` | mutation/domain logic | `src/modules/voice/mutations.js` | P1 | No |
| `routes/api/voice/utils.js` | transaction, strict event append, realtime emit, scoped HTTP helpers | mixed runtime helper + HTTP helpers | runtime helpers to `src/modules/voice/runtime.js`; HTTP helpers stay route adapter | P1 | No |
| `db/helpers/voice.js` | canonical voice DB helpers | shared infrastructure | keep in `src/db/helpers/voice.js` | P0 | No |

## Recommended staged sequence

1. Extract pure voice helpers to `src/modules/voice/shared.js`. Done in `refactor/voice-shared-pure-helpers`.
2. Keep `routes/api/voice/shared.js` as route adapter compatibility layer.
3. Update `voiceInternalRuntime.js` to import pure helpers from `modules/voice/shared.js`.
4. Extract route-free tenant lookup/data helpers to `src/modules/voice/repository.js`. Done in `refactor/voice-route-free-repository`.
5. Extract `upsertCallAndSession` to `src/modules/voice/mutations.js`. Done in `refactor/voice-call-session-mutations`.
6. Extract `buildVoiceConfigFromProjectedRuntime` to `src/modules/voice/config.js`. Done in `refactor/voice-runtime-config-builder`.
7. Extract transaction/event/realtime runtime helpers to `src/modules/voice/runtime.js`.
8. Only later consider `voice-backend` extraction.

## Non-goals

- Do not create `voice-backend` yet.
- Do not rename `twilio-voice-backend` yet.
- Do not move all voice code at once.
- Do not change Twilio/SIP/realtime behavior.
- Do not change DB schema.
- Do not change route paths.
- Do not change frontend endpoints.

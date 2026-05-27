# Voice System Architecture Audit

Date: 2026-05-27
Branch: `audit/voice-system-architecture`
Commit intent: `Audit voice system architecture`

This is a documentation-only audit. It does not change runtime behavior, route
contracts, database contracts, frontend behavior, environment files, or secrets.

## Reviewed Scope

| Area | Files inspected |
| --- | --- |
| Backend voice module | `ai-hq-backend/src/modules/voice/**` |
| Backend voice routes | `ai-hq-backend/src/routes/api/voice/**` |
| Backend voice tests | `ai-hq-backend/tests/*voice*` |
| Frontend voice surfaces | `ai-hq-frontend/src/pages/**/*Voice*` |
| Frontend Pionero hook | `ai-hq-frontend/src/pages/hooks/usePioneroLiveKitRoom.js` |
| Frontend voice API | `ai-hq-frontend/src/api/voice.js` |
| Related providers | Twilio, LiveKit, Soniox, OpenAI, Pionero related code found under the paths above |
| Business brain and truth | `ai-hq-backend/src/modules/voice/internal/*`, `ai-hq-backend/src/modules/voice/brain/*`, `ai-hq-backend/src/modules/voice/config.js`, `ai-hq-backend/src/modules/voice/actions/*` |

## Current Architecture Map

The current voice system has four visible lanes:

| Lane | Current purpose | Primary frontend | Primary backend |
| --- | --- | --- | --- |
| GPT Realtime browser lane | Operator/browser lab call directly against OpenAI Realtime, with AIHQ backend issuing ephemeral credentials and executing tools | `ai-hq-frontend/src/pages/BrowserVoiceCall.jsx`, `ai-hq-frontend/src/pages/hooks/useBrowserVoiceCall.js` | `ai-hq-backend/src/routes/api/voice/public.js`, `ai-hq-backend/src/modules/voice/engine/browserRealtimeSession.js`, realtime sideband modules |
| Pionero LiveKit/Soniox/OpenAI lane | Browser publishes mic to LiveKit, backend agent joins LiveKit, Soniox STT, OpenAI turn composer, Soniox TTS, operator-only audio bridge | `ai-hq-frontend/src/pages/hooks/usePioneroLiveKitRoom.js`, displayed inside `BrowserVoiceCall.jsx` | `ai-hq-backend/src/modules/voice/pionero/*`, `ai-hq-backend/src/routes/api/voice/public.js` |
| Speech Bridge/Soniox lane | Operator browser utility for Soniox STT/TTS through AIHQ backend HTTP endpoints | `ai-hq-frontend/src/pages/hooks/useBrowserSpeechBridge.js`, integrated by `useBrowserVoiceCall.js` | `ai-hq-backend/src/modules/voice/speech/*`, `ai-hq-backend/src/routes/api/voice/public.js` |
| Twilio/phone lane | Phone/sidecar control-plane contracts, voice settings, call state, internal sidecar API, and DB-facing call/session model | Voice ops routes and surfaces, plus sidecar callers | `ai-hq-backend/src/routes/api/voice/internal.js`, `ai-hq-backend/src/modules/voice/internal/*`, shared voice modules |

The strongest canonical voice-brain integration is currently in the GPT
Realtime browser lane and the Twilio/internal runtime lane. The Pionero lane is
provider-real for audio/STT/LLM/TTS, but it is not yet wired to the canonical
tenant business truth brain or tool-call loop.

## Backend Route Map

All route observations below come from
`ai-hq-backend/src/routes/api/voice/public.js::voiceRoutes`.

| Route family | Routes | Handler/function evidence |
| --- | --- | --- |
| Pionero LiveKit | `POST /voice/pionero/livekit/token`, `GET /voice/pionero/livekit/agent/plan`, `GET /voice/pionero/readiness`, `POST /voice/pionero/livekit/agent/start-plan`, `GET /voice/pionero/livekit/agent/status`, `GET /voice/pionero/livekit/agent/audio`, `POST /voice/pionero/livekit/agent/stop-plan` | `handlePioneroLiveKitToken`, `handlePioneroLiveKitAgentPlan`, `handlePioneroVoiceReadiness`, `handlePioneroLiveKitAgentStartPlan`, `handlePioneroLiveKitAgentStatus`, `handlePioneroLiveKitAgentAudio`, `handlePioneroLiveKitAgentStopPlan` |
| Speech gateway | `GET /voice/speech/gateway/readiness`, `POST /voice/speech/browser/transcribe`, `POST /voice/speech/browser/synthesize` | `handleVoiceSpeechGatewayReadiness`, `handleVoiceSpeechBrowserTranscribe`, `handleVoiceSpeechBrowserSynthesize` |
| Browser realtime | `POST /voice/browser/session`, `POST /voice/browser/calls/:callId/realtime-link`, `POST /voice/browser/calls/:callId/events`, `POST /voice/browser/calls/:callId/tools` | `handleBrowserVoiceSession`, `handleBrowserVoiceRealtimeLink`, `handleBrowserVoiceCallEvent`, `handleBrowserVoiceToolCall` |
| Voice ops | Settings, channels, calls, live sessions, QA, operator actions, usage, overview | Route definitions near the bottom of `public.js::voiceRoutes` |

`GET /voice/pionero/readiness` is the only Pionero route in this group that is
registered without `requireOperatorSurfaceAccess`; the other Pionero runtime
routes are operator-only. This is not necessarily a bug because readiness is a
safe summary, but production exposure needs an explicit decision.

The internal phone/sidecar routes are registered by
`ai-hq-backend/src/routes/api/voice/internal.js::voiceInternalRoutes`:

| Internal route | Purpose |
| --- | --- |
| `POST /internal/voice/tenant-config` | Resolve tenant voice runtime config for sidecar/gateway |
| `POST /internal/voice/session/upsert` | Upsert provider session state |
| `POST /internal/voice/session/transcript` | Append transcript material |
| `POST /internal/voice/session/state` | Update session state |
| `POST /internal/voice/session/operator-join` | Record operator join |
| `POST /internal/voice/report` | Report sidecar/runtime events |

The internal route guard is
`ai-hq-backend/src/routes/api/voice/internalAuth.js::createVoiceInternalTokenGuard`
with allowed services `twilio-voice-backend` and `voice-gateway-backend`.

## Lane 1: GPT Realtime Browser Lane

### Current Data Flow

1. The operator starts a browser call in
   `ai-hq-frontend/src/pages/hooks/useBrowserVoiceCall.js::startCall`.
2. The frontend requests `POST /voice/browser/session` through
   `ai-hq-frontend/src/api/voice.js::createBrowserVoiceSession`.
3. The backend handler
   `ai-hq-backend/src/routes/api/voice/public.js::handleBrowserVoiceSession`
   resolves tenant/runtime config with `processVoiceTenantConfig`, builds a
   Realtime session plan, creates a `voice_calls` row, and calls OpenAI
   `https://api.openai.com/v1/realtime/client_secrets`.
4. The session plan is built by
   `ai-hq-backend/src/modules/voice/engine/browserRealtimeSession.js::buildBrowserRealtimeSessionPlan`.
   It builds instructions from the canonical voice brain and tool definitions
   from the action runtime.
5. The frontend creates an `RTCPeerConnection`, obtains mic access with
   `navigator.mediaDevices.getUserMedia`, creates an `oai-events` data channel,
   posts SDP to `https://api.openai.com/v1/realtime/calls`, applies the answer,
   and attaches remote audio to `remoteAudioRef`.
6. The frontend links the provider call id back through
   `POST /voice/browser/calls/:callId/realtime-link`, handled by
   `handleBrowserVoiceRealtimeLink`.
7. Tool calls can run through the browser data-channel path:
   `useBrowserVoiceCall.js::runToolCall` calls
   `ai-hq-frontend/src/api/voice.js::executeBrowserVoiceTool`, which reaches
   `public.js::handleBrowserVoiceToolCall`.
8. When sideband is enabled, `handleBrowserVoiceRealtimeLink` starts
   `ai-hq-backend/src/modules/voice/realtimeSidebandSocketRunner.js::startRealtimeSidebandSocketRunner`.
   Tool dispatch then runs through
   `ai-hq-backend/src/modules/voice/realtimeSidebandToolDispatcher.js::dispatchRealtimeSidebandToolCall`.

### Current Status

This lane has the most complete canonical business-brain and tool-call
integration. It is still a browser/operator lane, not a public phone transport.
The frontend directly calls OpenAI Realtime with an ephemeral client secret
provided by the backend.

### Runtime State and Persistence

Observed state/persistence points:

| Concern | Current implementation |
| --- | --- |
| Call record | `public.js::handleBrowserVoiceSession` calls voice call creation before returning the browser session |
| Provider link | `public.js::handleBrowserVoiceRealtimeLink` stores provider session metadata and can start sideband |
| Browser events | `public.js::handleBrowserVoiceCallEvent` records safe browser realtime events |
| Tool idempotency | `realtimeToolExecutionIdempotency.js` plus `realtimeSidebandToolDispatcher.js::dispatchRealtimeSidebandToolCall` |
| Audio | Browser WebRTC stream to/from OpenAI; backend does not proxy raw browser audio |

## Lane 2: Pionero LiveKit/Soniox/OpenAI Lane

### Current Data Flow

1. The frontend hook
   `ai-hq-frontend/src/pages/hooks/usePioneroLiveKitRoom.js` uses
   `livekit-client` `Room`, `RoomEvent`, and `createLocalAudioTrack`.
2. `usePioneroLiveKitRoom.js::connect` calls
   `ai-hq-frontend/src/api/voice.js::createPioneroLiveKitSession`, which maps
   to `POST /voice/pionero/livekit/token`.
3. `public.js::handlePioneroLiveKitToken` reads LiveKit config, creates a
   browser LiveKit token, and returns a room/session payload.
4. The frontend pre-starts the backend agent through
   `POST /voice/pionero/livekit/agent/start-plan`, connects the browser to
   LiveKit, and publishes the microphone through
   `usePioneroLiveKitRoom.js::publishPioneroMicrophone`.
5. The backend runtime
   `ai-hq-backend/src/modules/voice/pionero/pioneroLiveKitAgentRuntime.js::createPioneroLiveKitAgentRuntime`
   stores one in-memory runner per `roomName`.
6. The backend runner
   `ai-hq-backend/src/modules/voice/pionero/pioneroLiveKitAgentRunner.js::createPioneroLiveKitAgentRunner`
   creates or receives LiveKit room-client seams, observes tracks, normalizes
   audio frames, buffers PCM, and flushes audio to STT.
7. STT is created by `pioneroLiveKitAgentRunner.js::createOptionalSttSession`
   through an injected seam or `createPioneroSonioxSttSessionFactory`.
8. Turn planning is handled by
   `pioneroLiveKitAgentRunner.js::recordTranscriptTurnPlans`. With
   `PIONERO_LIVEKIT_LLM_ENABLED=1`, it calls an OpenAI turn composer created
   by `createOpenAiTurnComposer`. If LLM is disabled, it creates plan-only TTS
   state.
9. TTS is handled by
   `pioneroLiveKitAgentRunner.js::synthesizeOrPlanTts`. With
   `PIONERO_LIVEKIT_TTS_ENABLED=1`, it calls a Soniox TTS session created by
   an injected seam or `createPioneroSonioxTtsSessionFactory`.
10. Successful TTS stores audio only in private in-memory runner state and
    exposes safe metadata in public status. The latest private audio is read by
    `pioneroLiveKitAgentRunner.js::getLatestTtsAudio` and
    `pioneroLiveKitAgentRuntime.js::getLatestTtsAudio`.
11. `public.js::handlePioneroLiveKitAgentAudio` returns the latest operator-only
    audio payload for a `roomName`. Current code wraps raw PCM in WAV before
    returning `audioBase64`.
12. The frontend polls status and, when TTS success counters advance, calls
    `ai-hq-frontend/src/api/voice.js::getPioneroLiveKitAgentAudio`. Playback
    is handled by `usePioneroLiveKitRoom.js::buildAgentAudioBlob` and the hook's
    audio playback path.

### Soniox Raw PCM Confirmation

Soniox TTS is configured as raw PCM in
`ai-hq-backend/src/modules/voice/speech/providers/sonioxRealtimeWebsocketClient.js::buildSonioxInitialConfig`,
which sets `audio_format: "pcm_s16le"` for TTS. The Pionero audio endpoint
therefore wraps the raw PCM in WAV in
`public.js::handlePioneroLiveKitAgentAudio` before returning browser-playable
audio.

### Current Pionero Runtime State Model

The runner state is built and sanitized in
`pioneroLiveKitAgentRunner.js::createPioneroLiveKitAgentRunner`.

| State area | Observed fields/functions |
| --- | --- |
| Readiness | LiveKit config, room client, STT, LLM, TTS readiness in runner state and `pioneroVoiceReadinessSnapshot.js::buildPioneroVoiceReadinessSnapshot` |
| Audio ingest | `recordPioneroAudioIngestFrame`, `recordPioneroAudioIngestEvent`, normalized PCM buffer metadata |
| STT | Soniox session status, transcripts, counters, errors |
| LLM | OpenAI turn composer status, planned response, counters, errors |
| TTS | Provider `soniox`, statuses including `synthesizing` and `speech_synthesized`, `synthesesAttempted`, `synthesesSucceeded`, `synthesesFailed`, `audioByteLength`, `audioChunkCount`, `networkIo`, `errorMessage` |
| Private audio | `latestTtsAudio` in the runner, exposed only through `getLatestTtsAudio` and the operator-only audio route |
| Sanitization | `safeStateObject` and route JSON safety wrappers prevent raw audio, token, and secret material from normal status responses |

### Current Gaps

| Gap | Evidence | Severity |
| --- | --- | --- |
| Agent audio is not published back into LiveKit as a media track | Playback currently goes through `public.js::handlePioneroLiveKitAgentAudio` and `usePioneroLiveKitRoom.js::maybeFetchAndPlayAgentAudio` | P0 blocker for production realtime Pionero |
| Runtime/audio is in-memory per backend process | `pioneroLiveKitAgentRuntime.js::createPioneroLiveKitAgentRuntime` stores runner entries in a local map | P1 important |
| Pionero does not yet use canonical tenant truth/brain instructions | Runner uses OpenAI turn composer path; canonical brain instructions are built by `brain/index.js::buildVoiceAssistantBrainInstructions` and used by browser realtime | P0 blocker before customer-facing Pionero |
| Pionero has no observed action/tool-call execution loop | No Pionero runner path was found that calls `buildVoiceActionToolDefinitions` or `executeVoiceAction` | P1 important |
| Provider metadata is stale in some Pionero token/request surfaces | `usePioneroLiveKitRoom.js::PIONERO_LIVEKIT_SESSION_REQUEST` uses `ttsProvider: "cartesia"` while synthesis uses Soniox | P1 important |
| Pionero readiness route exposure needs an explicit decision | `public.js::voiceRoutes` registers `/voice/pionero/readiness` without `requireOperatorSurfaceAccess` | P2 polish or P1, depending deployment exposure |

## Lane 3: Speech Bridge/Soniox Lane

### Current Data Flow

1. The frontend speech bridge recorder is implemented in
   `ai-hq-frontend/src/pages/hooks/useBrowserSpeechBridge.js`.
2. `useBrowserVoiceCall.js` integrates the bridge. It can transcribe recorded
   browser audio and synthesize text through `speakSpeechBridgeText`.
3. Frontend API helpers in `ai-hq-frontend/src/api/voice.js` call:
   `POST /voice/speech/browser/transcribe` and
   `POST /voice/speech/browser/synthesize`.
4. Backend route handlers are
   `public.js::handleVoiceSpeechBrowserTranscribe` and
   `public.js::handleVoiceSpeechBrowserSynthesize`.
5. Provider config is built by
   `ai-hq-backend/src/modules/voice/speech/voiceSpeechProviderConfig.js::buildVoiceSpeechProviderConfig`.
6. Pipeline compatibility is built by
   `ai-hq-backend/src/modules/voice/speech/voiceSpeechPipeline.js::buildVoiceSpeechPipeline`.
7. The gateway plan and adapter registry are built by
   `ai-hq-backend/src/modules/voice/speech/voiceSpeechGateway.js::buildVoiceSpeechGatewayPlan`,
   `createDefaultSpeechAdapterRegistry`, and `createVoiceSpeechGateway`.
8. Soniox config and adapters live in:
   `sonioxSpeechRuntimeConfig.js::buildSonioxSpeechRuntimeConfig`,
   `sonioxSpeechAdapter.js::createSonioxSpeechAdapter`,
   `sonioxSttSession.js::createSonioxSttSession`, and
   `sonioxTtsSession.js::createSonioxTtsSession`.

### Current Status

The Speech Bridge is a useful operator/browser utility and provider proof path.
It is not the full production call runtime. The gateway plan includes stages
for transport, turn taking, brain, and TTS output that are marked incomplete in
the plan model, while the route handlers can still perform direct browser STT
and TTS through adapters.

### Gap

The product architecture should distinguish "browser speech bridge utility" from
"full cascaded speech gateway runtime" so readiness does not overstate what the
gateway currently implements.

## Lane 4: Twilio/Phone Lane

### Current Data Flow Observed In This Repository

1. Voice settings and channel records can represent Twilio numbers through:
   `ai-hq-backend/src/modules/voice/settings.js::normalizeVoiceSettingsInput`,
   `ai-hq-backend/src/modules/voice/channelConnection.js`, and voice mutation
   helpers.
2. A phone sidecar or gateway can call internal AIHQ endpoints registered in
   `ai-hq-backend/src/routes/api/voice/internal.js::voiceInternalRoutes`.
3. Those internal endpoints resolve tenant/runtime voice config through
   `ai-hq-backend/src/modules/voice/internal/tenantConfig.js::processVoiceTenantConfig`,
   then update call/session/transcript/operator state through internal voice
   modules.
4. Production validation for the sidecar token is in
   `ai-hq-backend/src/config/validate.js`, which requires
   `AIHQ_INTERNAL_TOKEN_TWILIO_VOICE` or `AIHQ_INTERNAL_TWILIO_VOICE_TOKEN` in
   production.

### Needs Confirmation

The scoped AIHQ code contains the control-plane API for a Twilio sidecar, but it
does not contain Twilio webhook handlers, TwiML generation, Twilio media stream
websocket handling, or Twilio account credential loading. The actual media
sidecar implementation likely lives outside this scoped repository path or in a
separate service. This needs confirmation before assigning production readiness
to the Twilio media lane.

## Business Brain And Truth Integration

The canonical business truth integration path is:

| Step | File/function |
| --- | --- |
| Resolve tenant voice runtime | `ai-hq-backend/src/modules/voice/internal/tenantConfig.js::processVoiceTenantConfig` |
| Build projected runtime | `ai-hq-backend/src/modules/voice/internal/projectedRuntime.js::buildVoiceProjectedRuntime` |
| Shape voice config from approved runtime | `ai-hq-backend/src/modules/voice/config.js::buildVoiceConfigFromProjectedRuntime` |
| Build assistant brain instructions | `ai-hq-backend/src/modules/voice/brain/index.js::buildVoiceAssistantBrainInstructions` |
| Build browser realtime session | `ai-hq-backend/src/modules/voice/engine/browserRealtimeSession.js::buildBrowserRealtimeSessionPlan` |

`buildVoiceAssistantBrainInstructions` explicitly composes the runtime context,
intent policy, dialogue policy, grounding policy, action planning policy,
lifecycle policy, response composer policy, and trace policy.

Status by lane:

| Lane | Business truth status |
| --- | --- |
| GPT Realtime browser | Integrated through `buildBrowserRealtimeSessionPlan` and `buildVoiceAssistantBrainInstructions` |
| Twilio/internal sidecar | Integrated through `processVoiceTenantConfig` and internal runtime config APIs |
| Speech Bridge | Provider utility only; not a full assistant brain runtime |
| Pionero LiveKit | Needs integration; current OpenAI composer is not wired to canonical tenant truth/brain path in the inspected runner |

## Tool-Call Readiness

Tool definitions are built by
`ai-hq-backend/src/modules/voice/actions/voiceActionContracts.js::buildVoiceActionToolDefinitions`.
Runtime execution is handled by
`ai-hq-backend/src/modules/voice/actions/voiceActionRuntime.js::executeVoiceAction`.

Current tool inventory includes:

| Tool | Purpose |
| --- | --- |
| `check_availability` | Availability lookup |
| `create_business_request` | General business request capture |
| `create_reservation_request` | Reservation request capture |
| `create_order_request` | Order request capture |
| `create_appointment_request` | Appointment request capture |
| `create_handoff_request` | Human handoff request |
| `end_call` | Call termination intent |

Readiness by lane:

| Lane | Tool readiness |
| --- | --- |
| GPT Realtime browser | Ready for browser data-channel path and sideband path. Evidence: `useBrowserVoiceCall.js::runToolCall`, `public.js::handleBrowserVoiceToolCall`, `realtimeSidebandToolDispatcher.js::dispatchRealtimeSidebandToolCall` |
| Twilio/internal sidecar | Control-plane runtime exists; exact media/tool execution behavior in sidecar needs confirmation |
| Speech Bridge | Not an assistant tool-call lane |
| Pionero LiveKit | Not ready; no observed runner path executes voice action tools |

## Environment Variables And Production Config

This table lists variables observed in the inspected code. It does not list
secrets values.

| Area | Variables | Evidence |
| --- | --- | --- |
| OpenAI browser realtime | `OPENAI_API_KEY` | `public.js::handleBrowserVoiceSession`, sideband modules |
| OpenAI Pionero LLM | `OPENAI_API_KEY`, `PIONERO_OPENAI_MODEL`, `PIONERO_OPENAI_MAX_OUTPUT_TOKENS`, `PIONERO_OPENAI_TEMPERATURE`, `PIONERO_LIVEKIT_LLM_ENABLED` | `llm/providers/openaiLlmRuntimeConfig.js::readOpenAiLlmRuntimeConfig` |
| Realtime sideband | `VOICE_REALTIME_SIDEBAND_ENABLED`, `AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED` | `public.js::handleBrowserVoiceRealtimeLink`, sideband runner |
| LiveKit | `LIVEKIT_URL`, `LIVEKIT_WS_URL`, `VITE_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | `public.js::handlePioneroLiveKitToken`, `pioneroLiveKitAgent.js::readPioneroLiveKitAgentConfig` |
| Pionero agent identity | `PIONERO_AGENT_IDENTITY`, `PIONERO_AGENT_NAME` | `pioneroLiveKitAgent.js::readPioneroLiveKitAgentConfig` |
| Pionero room client | `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED`, `PIONERO_LIVEKIT_ROOM_CLIENT_MODULE` | `pioneroLiveKitRoomClassFactory.js::createPioneroLiveKitRoomClassFactory` |
| Pionero STT/LLM/TTS gates | `PIONERO_LIVEKIT_STT_ENABLED`, `PIONERO_LIVEKIT_LLM_ENABLED`, `PIONERO_LIVEKIT_TTS_ENABLED` | `pioneroLiveKitAgentRunner.js::createPioneroLiveKitAgentRunner` |
| Pionero STT buffering | `PIONERO_LIVEKIT_STT_MAX_FRAMES`, `PIONERO_LIVEKIT_STT_FLUSH_MS`, `PIONERO_LIVEKIT_STT_FLUSH_FRAMES` | `pioneroLiveKitAgentRunner.js::createPioneroLiveKitAgentRunner` |
| Soniox credentials | `SONIOX_API_KEY`, `VOICE_SONIOX_API_KEY`, `SONIOX_TOKEN`, `VOICE_SONIOX_TOKEN` | `speech/providers/sonioxSpeechRuntimeConfig.js::buildSonioxSpeechRuntimeConfig`, `voiceSpeechGateway.js::createDefaultSpeechAdapterRegistry` |
| Soniox STT/TTS config | `VOICE_LANGUAGE`, `SONIOX_LANGUAGE`, `VOICE_STT_LANGUAGE`, `SONIOX_STT_WEBSOCKET_URL`, `VOICE_SONIOX_STT_WEBSOCKET_URL`, `SONIOX_TTS_WEBSOCKET_URL`, `VOICE_SONIOX_TTS_WEBSOCKET_URL`, `SONIOX_STT_MODEL`, `VOICE_STT_MODEL`, `SONIOX_TTS_MODEL`, `VOICE_TTS_MODEL`, `SONIOX_TTS_VOICE`, `VOICE_TTS_VOICE`, `SONIOX_SAMPLE_RATE_HZ`, `VOICE_SAMPLE_RATE_HZ`, `SONIOX_INTERIM_RESULTS` | `speech/providers/sonioxSpeechRuntimeConfig.js::buildSonioxSpeechRuntimeConfig` |
| Speech gateway defaults | `VOICE_STT_PROVIDER`, `VOICE_TTS_PROVIDER`, `VOICE_TRANSPORT`, `VOICE_LLM_PROVIDER`, `VOICE_AGENT_MODE` | `voiceSpeechProviderConfig.js::buildVoiceSpeechProviderConfig` |
| Twilio/internal sidecar auth | `AIHQ_INTERNAL_TOKEN_TWILIO_VOICE`, `AIHQ_INTERNAL_TWILIO_VOICE_TOKEN` | `ai-hq-backend/src/config/validate.js` and `internalAuth.js::createVoiceInternalTokenGuard` |

Production required config by lane:

| Lane | Required production config |
| --- | --- |
| GPT Realtime browser | `OPENAI_API_KEY`, approved tenant runtime/business truth, operator auth, browser mic permissions, realtime sideband flags only if sideband is intended |
| Pionero LiveKit | LiveKit URL/key/secret, backend room client enabled and installed, Pionero STT/LLM/TTS gates, Soniox credentials/config, OpenAI credentials/config |
| Speech Bridge | Soniox credentials/config, operator auth |
| Twilio/phone | Internal sidecar token plus confirmed external sidecar Twilio credentials/webhooks. Twilio account credential names need confirmation in the sidecar implementation |

## Current Tests And What They Prove

Representative backend tests were found under `ai-hq-backend/tests/*voice*`.

| Test group | Representative tests | What they prove |
| --- | --- | --- |
| Browser realtime session | `browser-voice-realtime-session.test.js`, `voice-browser-realtime-session-readiness.test.js`, `voice-browser-realtime-vertical-playbook.test.js`, `voice-browser-session-readiness-gate.test.js` | Browser session planning, readiness gating, provider contract expectations, and vertical playbook behavior |
| Realtime sideband and tools | `voice-realtime-sideband-*.test.js`, `voice-realtime-tool-execution-idempotency.test.js`, `voice-realtime-provider-contract.test.js`, `voice-realtime-control-plane.test.js` | Sideband event processing, tool dispatch, provider adapters, idempotency, and control-plane target behavior |
| Pionero LiveKit | `voice-pionero-livekit-agent-runner.test.js`, `voice-pionero-livekit-agent-plan-route.test.js`, `voice-pionero-livekit-token-route.test.js`, `voice-pionero-livekit-roomclass-factory.test.js`, `voice-pionero-livekit-room-client-preflight.test.js`, `voice-pionero-livekit-live-room-smoke.test.js`, `voice-pionero-livekit-audio-monitor.test.js` | Pionero runner state, token and plan routes, room-client loading/preflight, bounded live smoke/monitor paths |
| Pionero readiness/speech loop | `voice-pionero-readiness-*.test.js`, `voice-pionero-speech-loop-smoke.test.js` | Readiness snapshot behavior and provider-loop smoke surfaces |
| Soniox and speech bridge | `voice-soniox-websocket-client.test.js`, `voice-soniox-stt-session.test.js`, `voice-soniox-tts-session.test.js`, `voice-soniox-speech-adapter.test.js`, `voice-speech-browser-bridge-route.test.js`, `voice-speech-gateway-contract.test.js`, `voice-speech-gateway-readiness-route.test.js`, `voice-speech-pipeline.test.js` | Soniox websocket/session contracts, speech adapter behavior, browser STT/TTS route behavior, gateway/pipeline contracts |
| Phone/internal runtime | `voice-internal-runtime-facade.test.js`, `voice-internal-runtime-hardening.test.js`, `voice-mutation-hardening.test.js`, `voice-number-connection-api.test.js`, `voice-channel-instances-contract.test.js`, `voice-call-state-manager.test.js` | Internal API hardening, voice channel/number contracts, call state manager behavior |
| Actions/brain/business truth | `voice-action-*.test.js`, `voice-business-action-*.test.js`, `voice-business-playbook.test.js`, `voice-openai-turn-composer.test.js`, `voice-runtime-evidence.test.js`, `voice-operation-request-store.test.js`, `voice-operator-actions.test.js`, `voice-operator-queue-read-model.test.js` | Action contracts/runtime, business playbooks, OpenAI turn composer behavior, runtime evidence, operation request storage, operator actions |
| QA | `voice-qa-*.test.js` | QA annotation/dataset/read model behavior |

Frontend voice tests exist for relevant hooks, including Pionero hook playback
coverage under `ai-hq-frontend/src/test/pages/hooks/usePioneroLiveKitRoom.test.jsx`.

## Runtime State Models And Gaps

| Runtime area | Current model | Gap |
| --- | --- | --- |
| Browser realtime | Durable call/session/event model plus OpenAI provider link and optional sideband state | Browser lane remains a lab/operator transport, not a production PSTN transport |
| Pionero runner | In-memory room runner state with safe public snapshots and private latest TTS audio | Needs durable call/session persistence, multi-instance coordination, and LiveKit audio publication |
| Speech Bridge | Stateless request/response gateway plus provider readiness plan | Needs clearer separation from full speech gateway runtime |
| Twilio/internal | Internal sidecar API plus DB-backed call/session state | External Twilio media sidecar implementation needs confirmation |
| Tool execution | Browser realtime has idempotent tool handling | Pionero tool loop absent; sidecar behavior needs confirmation |
| Audio safety | Pionero status avoids raw audio and endpoint is operator-only; normal status is sanitized | Endpoint still returns base64 audio by design for operator bridge; should be temporary or explicitly debug-only |

## Production Risks

### P0 Blockers

| Risk | Evidence | Recommendation |
| --- | --- | --- |
| Pionero production agent audio is not real LiveKit media output | Audio playback depends on `public.js::handlePioneroLiveKitAgentAudio` and frontend polling in `usePioneroLiveKitRoom.js::maybeFetchAndPlayAgentAudio` | Publish synthesized audio from the backend agent into the LiveKit room as an agent audio track |
| Pionero is not wired to approved tenant business truth/brain | Canonical brain path is `buildVoiceAssistantBrainInstructions`; Pionero runner uses the standalone OpenAI turn composer path | Reuse `processVoiceTenantConfig`, `buildVoiceConfigFromProjectedRuntime`, and canonical brain instructions in Pionero |
| Pionero runtime is in-memory only | `pioneroLiveKitAgentRuntime.js::createPioneroLiveKitAgentRuntime` stores active runners in process memory | Add worker ownership, sticky routing, durable session state, or a runtime lease model before multi-instance production |

### P1 Important

| Risk | Evidence | Recommendation |
| --- | --- | --- |
| Pionero provider metadata is inconsistent | Frontend session request still includes `ttsProvider: "cartesia"` while backend TTS synthesis is Soniox | Align user-facing and route metadata to Soniox |
| Pionero lacks durable call/session/transcript integration | Pionero runtime is separate from `voice_calls` route flow in inspected code | Create voice call/session records and append STT/LLM/TTS events |
| Pionero lacks tool-call readiness | No inspected Pionero runner path calls `buildVoiceActionToolDefinitions` or `executeVoiceAction` | Add canonical action/tool loop after brain parity |
| Speech gateway readiness semantics are mixed | Gateway plan stages include incomplete full-runtime stages while browser routes can do direct STT/TTS | Split naming/docs/contracts for bridge utility vs full gateway |
| Browser realtime client-side OpenAI call needs production hardening review | `useBrowserVoiceCall.js::startCall` posts SDP directly to OpenAI with ephemeral secret | Review origin controls, token TTL, CSP, and session lifecycle before external exposure |
| Twilio media sidecar not in scoped code | Internal API exists, media webhooks do not | Confirm sidecar repository/service and document its production env/health checks |

### P2 Polish

| Risk | Evidence | Recommendation |
| --- | --- | --- |
| Pionero readiness route guard is inconsistent with other Pionero routes | `/voice/pionero/readiness` is not operator guarded in `public.js::voiceRoutes` | Decide whether readiness is public-safe or operator-only |
| Pionero UI/provider wording can drift | Frontend request/provider labels still reference Cartesia | Clean labels after provider metadata PR |
| Speech Bridge playback uses data URLs in browser helper | `useBrowserVoiceCall.js::playBrowserVoiceSpeechAudio` builds data URL playback | Prefer Blob URL with cleanup for larger audio |
| `Voice.jsx` is not the main current surface | `ai-hq-frontend/src/pages/Voice.jsx` is effectively stripped while BrowserVoiceCall carries active lab UI | Clarify intended navigation and ownership |

## Recommended Professional Target Architecture

Target shape:

1. One canonical voice session runtime contract.
   - Inputs: tenant runtime, transport adapter, audio input adapter, STT adapter,
     turn composer, TTS adapter, tool dispatcher, persistence sink.
   - Outputs: safe public state, durable events/transcripts, provider telemetry,
     optional operator debug artifacts.
2. Transport adapters instead of lane-specific assistant brains.
   - Browser OpenAI Realtime adapter for lab/pre-SIP.
   - LiveKit adapter for Pionero realtime.
   - Twilio/SIP sidecar adapter for phone.
3. Speech adapters behind the same contracts.
   - OpenAI Realtime bundled audio model where appropriate.
   - Soniox STT/TTS through the speech provider adapter.
4. One canonical brain.
   - Every customer-facing lane uses `processVoiceTenantConfig`,
     `buildVoiceConfigFromProjectedRuntime`, and
     `buildVoiceAssistantBrainInstructions`.
5. One canonical tool execution model.
   - Tool definitions come from `buildVoiceActionToolDefinitions`.
   - Tool execution goes through `executeVoiceAction`.
   - Idempotency and action event persistence are shared.
6. Durable voice session/event storage for every production lane.
   - `voice_calls` and `voice_call_sessions` become common to Browser, LiveKit,
     and Twilio/SIP production lanes.
7. Pionero audio output through LiveKit media.
   - The backend agent publishes a LiveKit audio track.
   - `/agent/audio` remains a temporary operator-debug bridge or is removed
     after LiveKit publication is stable.
8. Safe observability.
   - Public status never contains raw audio, base64 audio, tokens, API keys, or
     provider secrets.
   - Debug endpoints are operator-only, bounded, and documented.

## Step-By-Step Roadmap With Small PRs

| PR | Scope | Outcome |
| --- | --- | --- |
| 1 | Provider metadata cleanup | Align Pionero `ttsProvider` labels and token/plan metadata to Soniox without behavior changes |
| 2 | Readiness and route policy | Decide and test whether `/voice/pionero/readiness` should be operator-only |
| 3 | Pionero durable session seed | Create or link `voice_calls`/`voice_call_sessions` when Pionero starts; store safe lifecycle events |
| 4 | Pionero transcript/event persistence | Append STT transcript, LLM plan, and TTS metadata events without raw audio |
| 5 | Pionero canonical brain integration | Build Pionero LLM instructions from tenant runtime/business truth instead of standalone prompt only |
| 6 | Pionero tool-call loop | Add canonical tool definitions, action execution, idempotency, and safe tool results to the Pionero turn flow |
| 7 | LiveKit agent audio publication | Publish Soniox TTS audio into the LiveKit room as backend agent media; keep audio debug endpoint operator-only during migration |
| 8 | Runtime ownership and scaling | Add runner ownership/lease model or dedicated worker topology for Pionero rooms |
| 9 | Speech Bridge naming/contract cleanup | Separate browser speech utility contracts from full cascaded gateway readiness |
| 10 | Twilio sidecar confirmation | Document sidecar repo, webhook surface, env vars, media flow, and health checks |
| 11 | Production smoke matrix | Add flagged provider smokes for LiveKit/Soniox/OpenAI and confirmed Twilio sidecar flows |

## Final Assessment

The codebase has a solid canonical voice brain and action runtime foundation in
AIHQ backend, and the browser GPT Realtime lane already exercises much of it.
The Pionero lane has advanced quickly into real provider integration for
LiveKit ingest, Soniox STT, OpenAI LLM, and Soniox TTS, but it is still a
runtime prototype from a production architecture perspective because agent
audio playback is bridged through an operator-only HTTP audio endpoint, state is
process-local, and the lane is not yet connected to the canonical business
truth brain or tool dispatcher.

The professional path is to keep the provider-specific transport work, but move
all customer-facing lanes toward one shared voice runtime contract, one
canonical business brain, one action/tool loop, durable session/event storage,
and true transport-native audio output.

# Voice System Audit

Status: working architecture audit, not a deletion PR.

## Product decision

We are building:

```text
AI Voice Receptionist
```

The product goal is not "Voice Lab" and not a keyword bot.

The product goal:

```text
A business receives a call.
The AI receptionist answers naturally.
It uses approved Business Truth.
It does not invent facts.
It asks one question at a time.
It collects the minimum useful details.
It offers human handoff when needed.
```

## Canonical architecture

```text
ai-hq-backend
  = canonical voice brain / runtime / business truth / composer

twilio-voice-backend
  = Twilio provider adapter and legacy deterministic call orchestration

future sip gateway
  = SIP provider adapter

ai-hq-frontend Voice Lab
  = internal browser test phone before buying/connecting a real number
```

## Hard rule

There must not be multiple competing assistant brains.

Wrong:

```text
browser lab brain
+ Twilio brain
+ SIP brain
+ ai-hq-backend brain
```

Correct:

```text
one canonical brain in ai-hq-backend
provider adapters only carry audio, call state, transfer, hangup, and provider-specific events
```

## Reviewed files and status

### ai-hq-backend voice brain

| Path | Status | Decision |
| --- | --- | --- |
| `ai-hq-backend/src/modules/voice/conversationComposer.js` | Canonical brain | KEEP |
| `ai-hq-backend/src/modules/voice/config.js` | Runtime voice config builder | KEEP |
| `ai-hq-backend/src/modules/voice/labScenarios.js` | Canonical internal test/playbook scenarios | KEEP, not customer-facing |
| `ai-hq-backend/src/modules/voice/labEvaluation.js` | Internal test result storage | KEEP for internal QA |
| `ai-hq-backend/src/modules/voice/internal/tenantConfig.js` | Runtime/tenant/operational voice resolver | KEEP |
| `ai-hq-backend/src/routes/api/voice/public.js` | Voice routes including lab session APIs | KEEP, protect as operator/internal |
| `ai-hq-backend/src/routes/api/voice/index.js` | Voice route registration | KEEP |

Decision:

```text
This is the correct direction for the real product.
The assistant's behavior must be generated from this side.
```

### ai-hq-frontend

| Path | Status | Decision |
| --- | --- | --- |
| `ai-hq-frontend/src/pages/VoiceLab.jsx` | Internal browser test phone | KEEP, but do not turn into customer product |
| `ai-hq-frontend/src/api/voice.js` | Voice API client | KEEP |
| `ai-hq-frontend/src/components/layout/shellNavigation.js` | Navigation | KEEP for now; Voice Lab may remain visible during internal build phase |

Decision:

```text
Voice Lab exists only so we can talk to the agent before SIP/Twilio number rollout.
It must stay simple.
No prompt editor.
No customer-facing developer concepts.
```

### twilio-voice-backend

| Path | Status | Decision |
| --- | --- | --- |
| `twilio-voice-backend/src/services/voice/core.js` | Provider call orchestration plus legacy deterministic brain | KEEP FOR NOW, mark LEGACY BRAIN |
| `twilio-voice-backend/src/services/voice/intents.js` | Keyword/heuristic intent helpers | KEEP AS GUARDRAILS ONLY |
| `twilio-voice-backend/src/services/voice/i18n.js` | Multi-language fallback texts | KEEP AS FALLBACK TEMPLATES |
| `twilio-voice-backend/src/services/voice/lead.js` | Legacy lead extraction/report helper | KEEP FOR NOW, review later |
| `twilio-voice-backend/src/services/voice/instructions.js` | Twilio voice instructions | REVIEW |
| `twilio-voice-backend/src/services/voice/legacySelectors.js` | Legacy selector logic | REVIEW / DELETE LATER candidate |
| `twilio-voice-backend/src/services/voice/shared.js` | Shared utility | KEEP |
| `twilio-voice-backend/src/services/voice/qRuntimeIncidentClient.js` | Runtime incident client | REVIEW |

Decision:

```text
twilio-voice-backend is not useless.
It is useful as a Twilio provider adapter.

But its current core.js contains legacy deterministic assistant behavior.
That behavior must not become the main product brain.
```

## About keyword logic

Keyword/heuristic logic is allowed only for deterministic guardrails:

```text
operator request
hangup / goodbye
yes / no confirmation
misheard speech
clear emergency/off-topic detection
basic provider routing
```

Keyword/heuristic logic is not allowed as the main assistant brain:

```text
pricing answer
business FAQ answer
sales qualification
booking flow
restaurant order flow
support conversation
```

Those must come from:

```text
Business Truth
+ runtime
+ scenario/playbook
+ conversation composer
+ realtime model behavior
```

## Immediate cleanup decision

Do not delete Twilio backend now.

Do not build new integrations now.

Do not add more Voice Lab complexity now.

Next engineering focus:

```text
1. Test current voice agent by browser call.
2. If speech quality is acceptable, tune ai-hq-backend conversation composer.
3. Later refactor Twilio core so it calls canonical ai-hq-backend brain instead of owning behavior.
4. Only after that, remove or reduce legacy keyword behavior.
```

## Refactor target

Final Twilio shape:

```text
Twilio call comes in
→ Twilio sidecar handles stream/call/transfer/hangup
→ asks ai-hq-backend for canonical voice session/instructions/response policy
→ sends audio/text response back through Twilio
```

Twilio must not decide product conversation strategy.

## Deletion policy

Only delete files when all are true:

```text
1. no route imports it
2. no tests import it
3. no provider runtime imports it
4. no production fallback depends on it
5. canonical replacement exists in ai-hq-backend
```

## Truthmode conclusion

Current status:

```text
ai-hq-backend voice architecture: promising and should be canonical
twilio-voice-backend: useful provider adapter, but polluted with legacy brain logic
Voice Lab: now correctly simplified as internal test phone
keyword system: acceptable only as guardrail, not as product brain
deletion now: unsafe
next step: test real voice quality, then refactor legacy brain out of Twilio
```

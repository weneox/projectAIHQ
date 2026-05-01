# Project AIHQ

Project AIHQ is a multi-tenant AI business operations platform.

It collects approved business truth, turns it into a governed runtime, connects customer channels, and helps operate customer conversations through AI-assisted inbox, handoff, lead, and execution workflows.

## What this system is trying to do

The platform is built around four core goals:

1. Build a trusted business profile from setup, website sources, Google Maps sources, and manual review.
2. Convert approved business truth into a runtime projection that AI can safely use.
3. Connect customer channels such as website chat, Instagram/Meta, Telegram, and Twilio Voice.
4. Route inbound customer messages through a guarded decision pipeline that can reply, hand off to an operator, create leads, or take no action.

## Monorepo layout

| Path | Purpose |
| --- | --- |
| ai-hq-backend | Main control plane API, auth, tenants, setup, truth, inbox, channels, workers, runtime readiness |
| ai-hq-frontend | Main React operator/admin application |
| meta-bot-backend | Meta/Instagram webhook and outbound sidecar |
| twilio-voice-backend | Twilio voice and realtime stream sidecar |
| shared-contracts | Shared logger, health, runtime, and integration contracts |
| neox-frontend | Separate frontend surface |

## Production posture

Default production posture should be fail-closed:

- No database means the control plane must not advertise ready.
- No approved truth means autonomous replies must not run.
- No runtime projection means channels must not be trusted as live.
- No channel verification means inbound webhooks must be rejected.
- Missing internal/auth secrets must block production startup.
- Autonomous mode should be enabled only after explicit launch approval.

## Safety note

This system can produce customer-facing responses. Treat any live channel as production-risk until all readiness, truth, runtime, and channel checks pass.

Do not enable autonomous replies for a tenant unless:

- business truth is approved,
- runtime projection is current,
- channel delivery is verified,
- outbound execution is observable,
- operator fallback is available,
- logs and incident trails are monitored.

## Recommended PR order

1. Documentation and CI foundation.
2. Production config hardening.
3. Channel webhook hardening.
4. Autonomous-mode launch gate.
5. Upload/static asset audit.
6. Runtime observability and alerting.

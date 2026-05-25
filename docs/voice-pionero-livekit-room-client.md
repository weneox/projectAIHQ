# Pionero LiveKit Room Client

## Purpose

Pionero uses LiveKit as the future server-side realtime voice transport for the backend agent participant. The RoomClass client is the small runtime seam that will eventually let the backend agent join a LiveKit room, observe subscribed browser audio, and later feed the STT, LLM, and TTS pipeline.

This document covers the operational preflight and live smoke checks. It does not enable a real room client by default.

## Default Behavior

The Pionero room client is disabled by default. When `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED` is unset, `0`, or anything other than `1` or `true`, the backend returns the existing planned no-network state for the agent start-plan route.

The preflight command is safe to run while disabled:

```bash
npm run check:pionero-room-client -w ai-hq-backend
```

Disabled output reports `ok: true`, `available: false`, and `reasonCode: "pionero_livekit_room_client_disabled"`.

## Dependency Proof

Before enabling a real server-side Room client, validate the target module import and export shape:

```bash
npm run check:pionero-room-client-module -w ai-hq-backend
```

This check only imports the configured module, resolves a Room class export, and verifies that `connect` and `disconnect` methods are present. It never connects to LiveKit.

The real dependency must be added in a separate PR only after this module-shape check passes in the target environment.

## Installed Backend Dependency

`@livekit/rtc-node` is installed for backend RoomClass loading. The Pionero RoomClass path is still disabled by default, and enabling it still requires setting `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=1`.

Rollback remains the same: set `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=0` to return to the no-default-network planned state.

## Live Room Smoke

Run the live room smoke command with:

```bash
npm run smoke:pionero-live-room -w ai-hq-backend
```

The command is double opt-in. It skips with `networkIo: false` unless both flags are enabled:

- `PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED=1`
- `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=1`

When enabled, it also requires:

- `LIVEKIT_URL` or `LIVEKIT_WS_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

The smoke joins the configured LiveKit room with the Pionero agent runner and immediately stops the runner in cleanup. Roll back by setting either opt-in flag to `0`.

## Live Audio Monitor

Run the bounded live audio monitor with:

```bash
npm run monitor:pionero-live-audio -w ai-hq-backend
```

The monitor is double opt-in. It only connects when both `PIONERO_LIVEKIT_LIVE_MONITOR_ENABLED=1` and `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=1` are set. It keeps the backend Pionero agent in a LiveKit room for `PIONERO_LIVEKIT_LIVE_MONITOR_SECONDS` seconds, clamped from 1 to 60 seconds, then stops the runner in cleanup.

The default room is `pionero-browser-test`, matching the browser Pionero lane. To verify live browser mic diagnostics, start the monitor, then open BrowserVoiceCall, start the Pionero lane, and publish microphone audio. The monitor reports safe track and frame diagnostics only; it does not prove STT readiness.

For browser-side monitor-only verification:

1. Open `/voice-assistant?pioneroMonitor=1`.
2. Click `Start Pionero realtime call`.
3. Speak for 5-10 seconds.
4. Check the monitor output for `observedAudio`, `tracksObserved`, or `framesObserved`.

Monitor-only browser mode publishes the microphone without starting another backend agent runner. It only proves that `rtc-node` receives safe LiveKit track or frame diagnostics, not that STT is ready.

Roll back by setting either opt-in flag to `0`.

## Live Audio Ingest Diagnostics

The Pionero runner reports safe LiveKit audio ingest diagnostics so operators can verify that the backend agent is seeing room events, subscribed microphone tracks, and audio frame counters.

Diagnostics are limited to event counts, frame and byte counters, and safe track metadata such as kind and source. They do not include raw audio, base64 audio, chunks, tokens, API credentials, or JWT-like values.

These diagnostics do not prove STT readiness. They only prove the ingest skeleton observed LiveKit room or track activity before a real STT/LLM/TTS loop is enabled.

## Live Monitor Troubleshooting

Use the live audio monitor counters to locate the first missing step:

- `remoteParticipantsObserved = 0`: the browser is not in the same room or is not connected.
- `remoteParticipantsObserved > 0` and `audioPublicationsObserved = 0`: the browser connected, but microphone audio was not published.
- `audioPublicationsObserved > 0` and `subscribedAudioTracksObserved = 0`: the backend sees the publication, but subscription or RoomEvent mapping needs attention.
- `subscribedAudioTracksObserved > 0` and `framesObserved = 0`: the backend subscribed, but audio frame extraction mapping needs attention.
- `framesObserved > 0`: the ingest skeleton is ready for Soniox STT wiring.

## Environment

LiveKit token and room planning use:

- `LIVEKIT_URL` or `LIVEKIT_WS_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Room client preflight and future RoomClass loading use:

- `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED`
- `PIONERO_LIVEKIT_ROOM_CLIENT_MODULE`

`PIONERO_LIVEKIT_ROOM_CLIENT_MODULE` defaults to `@livekit/rtc-node`.

## Safe Enable Sequence

1. Deploy with `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=0`.
2. Run `npm run check:pionero-room-client -w ai-hq-backend`.
3. Install a verified room client module in a separate PR.
4. Set `PIONERO_LIVEKIT_ROOM_CLIENT_MODULE` to the verified module name.
5. Set `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=1` only after preflight passes.

## Rollback

Set:

```bash
PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED=0
```

This restores the no-default-network planned state without removing the deployment.

## Logging Policy

The preflight and RoomClass factory must not log or print tokens, API keys, API secrets, raw audio, base64 audio, audio chunks, or JWT-like values. Safe operational fields are limited to enabled state, module name, availability, and reason codes.

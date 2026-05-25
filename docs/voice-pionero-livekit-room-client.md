# Pionero LiveKit Room Client

## Purpose

Pionero uses LiveKit as the future server-side realtime voice transport for the backend agent participant. The RoomClass client is the small runtime seam that will eventually let the backend agent join a LiveKit room, observe subscribed browser audio, and later feed the STT, LLM, and TTS pipeline.

This document covers the operational preflight only. It does not enable a real room client and it does not add the LiveKit Node room dependency.

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

## Environment

LiveKit token and room planning use:

- `LIVEKIT_URL` or `LIVEKIT_WS_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Room client preflight and future RoomClass loading use:

- `PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED`
- `PIONERO_LIVEKIT_ROOM_CLIENT_MODULE`

`PIONERO_LIVEKIT_ROOM_CLIENT_MODULE` defaults to `@livekit/rtc-node`, but that dependency is not installed by this step.

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

import { pathToFileURL } from "url";

import {
  createPioneroLiveKitAgentRunner,
  createPioneroLiveKitRoomClassFactory,
  readPioneroLiveKitAgentConfig,
} from "../src/modules/voice/index.js";

export const PIONERO_LIVEKIT_LIVE_ROOM_SMOKE_VERSION =
  "pionero_livekit_live_room_smoke.v1";

const DEFAULT_ROOM_NAME = "aihq-pionero-live-smoke";
const SENSITIVE_VALUE_PATTERNS = [
  "token",
  "secret",
  "rawaudio",
  "audiobase64",
  "audiochunk",
  "apikey",
  "apisecret",
  "jwt",
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function isEnabled(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
}

function n(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return Math.floor(numericValue);
}

function safeText(value = "") {
  const normalized = s(value);
  const lowered = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "[redacted]";
  }

  return normalized;
}

function readSafeRoomName(env = {}) {
  return (
    s(env.PIONERO_LIVEKIT_LIVE_SMOKE_ROOM_NAME)
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || DEFAULT_ROOM_NAME
  );
}

function readMissingLiveKitConfig(env = {}) {
  const config = readPioneroLiveKitAgentConfig(env);

  return {
    livekitUrl: !config.url,
    livekitCredentialId: !config.apiKey,
    livekitCredentialProof: !config.apiSecret,
  };
}

function hasMissingConfig(missing = {}) {
  return Object.values(missing).some((value) => value === true);
}

function readRoomClient(value = null) {
  if (typeof value === "function") {
    return {
      RoomClass: value,
      RoomEvent: value.RoomEvent || null,
    };
  }

  if (value && typeof value === "object") {
    return {
      RoomClass: typeof value.RoomClass === "function"
        ? value.RoomClass
        : typeof value.Room === "function"
          ? value.Room
          : null,
      RoomEvent: value.RoomEvent || null,
    };
  }

  return {
    RoomClass: null,
    RoomEvent: null,
  };
}

function buildSmokeResult({
  ok,
  skipped = false,
  networkIo = false,
  status = "",
  stopStatus = "",
  roomName = "",
  agentIdentity = "",
  reasonCode = "",
  audioIngestStatus = "",
  tracksObserved = 0,
  framesObserved = 0,
  bytesObserved = 0,
  lastEventName = "",
  lastTrackKind = "",
  lastTrackSource = "",
  sttStatus = "",
  llmStatus = "",
  ttsStatus = "",
  missing = null,
} = {}) {
  return {
    ok: ok === true,
    version: PIONERO_LIVEKIT_LIVE_ROOM_SMOKE_VERSION,
    skipped: skipped === true,
    networkIo: networkIo === true,
    status: safeText(status),
    stopStatus: safeText(stopStatus),
    roomName: safeText(roomName),
    agentIdentity: safeText(agentIdentity),
    reasonCode: safeText(reasonCode),
    audioIngestStatus: safeText(audioIngestStatus),
    tracksObserved: n(tracksObserved),
    framesObserved: n(framesObserved),
    bytesObserved: n(bytesObserved),
    lastEventName: safeText(lastEventName),
    lastTrackKind: safeText(lastTrackKind),
    lastTrackSource: safeText(lastTrackSource),
    sttStatus: safeText(sttStatus),
    llmStatus: safeText(llmStatus),
    ttsStatus: safeText(ttsStatus),
    ...(missing ? { missing } : {}),
  };
}

export async function runPioneroLiveKitLiveRoomSmoke({
  env = process.env,
  roomClassFactory = null,
  createRunner = createPioneroLiveKitAgentRunner,
  now = null,
} = {}) {
  const roomName = readSafeRoomName(env);

  try {
    if (!isEnabled(env.PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED)) {
      return buildSmokeResult({
        ok: true,
        skipped: true,
        networkIo: false,
        roomName,
        reasonCode: "pionero_livekit_live_smoke_disabled",
      });
    }

    if (!isEnabled(env.PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED)) {
      return buildSmokeResult({
        ok: true,
        skipped: true,
        networkIo: false,
        roomName,
        reasonCode: "pionero_livekit_room_client_disabled",
      });
    }

    const missing = readMissingLiveKitConfig(env);

    if (hasMissingConfig(missing)) {
      return buildSmokeResult({
        ok: false,
        skipped: true,
        networkIo: false,
        roomName,
        reasonCode: "livekit_config_missing",
        missing,
      });
    }

    const resolveRoomClass =
      typeof roomClassFactory === "function"
        ? roomClassFactory
        : createPioneroLiveKitRoomClassFactory({
            env,
            logger: null,
          });
    const roomClient = readRoomClient(await resolveRoomClass({ roomName }));
    const { RoomClass, RoomEvent } = roomClient;

    if (typeof RoomClass !== "function") {
      return buildSmokeResult({
        ok: false,
        skipped: true,
        networkIo: false,
        roomName,
        reasonCode: "pionero_livekit_room_client_unavailable",
      });
    }

    const runner = createRunner({
      RoomClass,
      ...(RoomEvent ? { RoomEvent } : {}),
      env,
      logger: null,
      now,
      roomName,
    });
    let startState = null;
    let stopState = null;

    try {
      startState = await runner.start();
    } finally {
      stopState = await runner.stop?.();
    }

    return buildSmokeResult({
      ok: startState?.status === "connected" && stopState?.status === "stopped",
      skipped: false,
      networkIo: startState?.networkIo === true,
      status: startState?.status,
      stopStatus: stopState?.status,
      roomName: startState?.roomName || roomName,
      agentIdentity: startState?.agentIdentity,
      reasonCode: startState?.reasonCode,
      audioIngestStatus: startState?.audioIngest?.status,
      tracksObserved: startState?.audioIngest?.tracksObserved,
      framesObserved: startState?.audioIngest?.framesObserved,
      bytesObserved: startState?.audioIngest?.bytesObserved,
      lastEventName: startState?.audioIngest?.lastEventName,
      lastTrackKind: startState?.audioIngest?.lastTrackKind,
      lastTrackSource: startState?.audioIngest?.lastTrackSource,
      sttStatus: startState?.stt?.status,
      llmStatus: startState?.llm?.status,
      ttsStatus: startState?.tts?.status,
    });
  } catch {
    return buildSmokeResult({
      ok: false,
      skipped: false,
      networkIo: false,
      roomName,
      reasonCode: "pionero_livekit_live_room_smoke_failed",
    });
  }
}

async function main() {
  const result = await runPioneroLiveKitLiveRoomSmoke();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

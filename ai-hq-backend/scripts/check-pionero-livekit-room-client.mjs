import { pathToFileURL } from "url";

import {
  createPioneroLiveKitRoomClassFactory,
} from "../src/modules/voice/index.js";

export const PIONERO_LIVEKIT_ROOM_CLIENT_PREFLIGHT_VERSION =
  "pionero_livekit_room_client_preflight.v1";

const DEFAULT_LIVEKIT_ROOM_CLIENT_MODULE = "@livekit/rtc-node";
const ROOM_NAME = "pionero-preflight";
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

function readModuleName(env = {}) {
  return s(
    env.PIONERO_LIVEKIT_ROOM_CLIENT_MODULE,
    DEFAULT_LIVEKIT_ROOM_CLIENT_MODULE
  );
}

function safeModuleName(moduleName = "") {
  const normalized = s(moduleName);
  const lowered = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "[redacted]";
  }

  return normalized;
}

function buildPreflightResult({
  ok,
  enabled,
  moduleName,
  available = false,
  roomClassFound = false,
  reasonCode = "",
} = {}) {
  return {
    ok: ok === true,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_PREFLIGHT_VERSION,
    enabled: enabled === true,
    moduleName: safeModuleName(moduleName),
    available: available === true,
    roomClassFound: roomClassFound === true,
    reasonCode: s(reasonCode),
  };
}

export async function runPioneroLiveKitRoomClientPreflight({
  env = process.env,
  importer = null,
} = {}) {
  try {
    const enabled = isEnabled(env?.PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED);
    const moduleName = readModuleName(env);

    if (!enabled) {
      return buildPreflightResult({
        ok: true,
        enabled,
        moduleName,
        reasonCode: "pionero_livekit_room_client_disabled",
      });
    }

    const factory = createPioneroLiveKitRoomClassFactory({
      env,
      logger: null,
      ...(typeof importer === "function" ? { importer } : {}),
    });
    const RoomClass = await factory({ roomName: ROOM_NAME });
    const roomClassFound = typeof RoomClass === "function";

    return buildPreflightResult({
      ok: roomClassFound,
      enabled,
      moduleName,
      available: roomClassFound,
      roomClassFound,
      reasonCode: roomClassFound
        ? ""
        : "pionero_livekit_room_client_unavailable",
    });
  } catch {
    return buildPreflightResult({
      ok: false,
      enabled: isEnabled(env?.PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED),
      moduleName: readModuleName(env),
      reasonCode: "pionero_livekit_room_client_unavailable",
    });
  }
}

async function main() {
  const result = await runPioneroLiveKitRoomClientPreflight();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

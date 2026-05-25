export const PIONERO_LIVEKIT_ROOM_CLASS_FACTORY_VERSION =
  "pionero_livekit_room_class_factory.v1";

const DEFAULT_LIVEKIT_ROOM_CLIENT_MODULE = "@livekit/rtc-node";
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

function safeText(value = "") {
  const normalized = s(value);
  const lowered = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "[redacted]";
  }

  return normalized;
}

function readRoomClass(moduleNamespace = {}) {
  if (typeof moduleNamespace?.Room === "function") {
    return moduleNamespace.Room;
  }

  if (typeof moduleNamespace?.default?.Room === "function") {
    return moduleNamespace.default.Room;
  }

  if (typeof moduleNamespace?.default === "function") {
    return moduleNamespace.default;
  }

  return null;
}

function readRoomEvent(moduleNamespace = {}) {
  if (moduleNamespace?.RoomEvent && typeof moduleNamespace.RoomEvent === "object") {
    return moduleNamespace.RoomEvent;
  }

  if (
    moduleNamespace?.default?.RoomEvent &&
    typeof moduleNamespace.default.RoomEvent === "object"
  ) {
    return moduleNamespace.default.RoomEvent;
  }

  return null;
}

function decorateRoomClass(RoomClass, RoomEvent = null) {
  if (typeof RoomClass !== "function") return null;

  try {
    Object.defineProperties(RoomClass, {
      RoomClass: {
        configurable: true,
        value: RoomClass,
      },
      RoomEvent: {
        configurable: true,
        value: RoomEvent,
      },
    });
  } catch {
    // Keep backwards compatibility by returning the RoomClass even if metadata
    // cannot be attached to a sealed constructor.
  }

  return RoomClass;
}

function logWarn(logger = null, event = "", fields = {}) {
  try {
    logger?.warn?.(event, {
      enabled: fields.enabled === true,
      moduleName: safeText(fields.moduleName),
      roomName: safeText(fields.roomName),
      reasonCode: safeText(fields.reasonCode),
    });
  } catch {
    // Logging should never make the optional RoomClass seam fail closed loudly.
  }
}

function defaultImporter(moduleName) {
  return import(moduleName);
}

export function createPioneroLiveKitRoomClassFactory({
  env = process.env,
  logger = null,
  importer = defaultImporter,
} = {}) {
  return async function pioneroLiveKitRoomClassFactory({ roomName } = {}) {
    const enabled = isEnabled(env?.PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED);
    const moduleName = s(
      env?.PIONERO_LIVEKIT_ROOM_CLIENT_MODULE,
      DEFAULT_LIVEKIT_ROOM_CLIENT_MODULE
    );

    if (!enabled) {
      return null;
    }

    try {
      const moduleNamespace = await importer(moduleName);
      const RoomClass = readRoomClass(moduleNamespace);
      const RoomEvent = readRoomEvent(moduleNamespace);

      if (!RoomClass) {
        logWarn(logger, "pionero.livekit.room_class_factory.invalid_module", {
          enabled,
          moduleName,
          roomName,
          reasonCode: "pionero_livekit_room_class_missing",
        });
        return null;
      }

      return decorateRoomClass(RoomClass, RoomEvent);
    } catch {
      logWarn(logger, "pionero.livekit.room_class_factory.import_failed", {
        enabled,
        moduleName,
        roomName,
        reasonCode: "pionero_livekit_room_class_import_failed",
      });
      return null;
    }
  };
}

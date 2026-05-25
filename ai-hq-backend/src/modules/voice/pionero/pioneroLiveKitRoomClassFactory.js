export const PIONERO_LIVEKIT_ROOM_CLASS_FACTORY_VERSION =
  "pionero_livekit_room_class_factory.v1";

const DEFAULT_LIVEKIT_ROOM_CLIENT_MODULE = "@livekit/rtc-node";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function isEnabled(value = "") {
  return ["1", "true"].includes(s(value).toLowerCase());
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

function logWarn(logger = null, event = "", fields = {}) {
  try {
    logger?.warn?.(event, {
      enabled: fields.enabled === true,
      moduleName: s(fields.moduleName),
      roomName: s(fields.roomName),
      reasonCode: s(fields.reasonCode),
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

      if (!RoomClass) {
        logWarn(logger, "pionero.livekit.room_class_factory.invalid_module", {
          enabled,
          moduleName,
          roomName,
          reasonCode: "pionero_livekit_room_class_missing",
        });
        return null;
      }

      return RoomClass;
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

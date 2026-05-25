import { pathToFileURL } from "url";

export const PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION =
  "pionero_livekit_room_client_module_shape.v1";

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

function readModuleName(env = {}) {
  return s(
    env.PIONERO_LIVEKIT_ROOM_CLIENT_MODULE,
    DEFAULT_LIVEKIT_ROOM_CLIENT_MODULE
  );
}

function defaultImporter(moduleName) {
  return import(moduleName);
}

function safeModuleName(moduleName = "") {
  const normalized = s(moduleName);
  const lowered = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "[redacted]";
  }

  return normalized;
}

function resolveRoomClass(importedModule = {}) {
  if (typeof importedModule?.Room === "function") {
    return {
      RoomClass: importedModule.Room,
      roomClassExportShape: "named.Room",
    };
  }

  if (typeof importedModule?.default?.Room === "function") {
    return {
      RoomClass: importedModule.default.Room,
      roomClassExportShape: "default.Room",
    };
  }

  if (typeof importedModule?.default === "function") {
    return {
      RoomClass: importedModule.default,
      roomClassExportShape: "default",
    };
  }

  return {
    RoomClass: null,
    roomClassExportShape: "missing",
  };
}

function instantiateRoomClass(RoomClass) {
  try {
    return new RoomClass();
  } catch {
    return null;
  }
}

function hasMethod(RoomClass, instance, methodName) {
  return (
    typeof instance?.[methodName] === "function" ||
    typeof RoomClass?.prototype?.[methodName] === "function"
  );
}

function buildModuleShapeResult({
  ok,
  moduleName,
  importOk = false,
  roomClassFound = false,
  roomClassExportShape = "missing",
  connectMethodExpected = false,
  disconnectMethodExpected = false,
  reasonCode = "",
} = {}) {
  return {
    ok: ok === true,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION,
    moduleName: safeModuleName(moduleName),
    importOk: importOk === true,
    roomClassFound: roomClassFound === true,
    roomClassExportShape,
    connectMethodExpected: connectMethodExpected === true,
    disconnectMethodExpected: disconnectMethodExpected === true,
    reasonCode: s(reasonCode),
  };
}

export async function runPioneroRoomClientModuleShapeCheck({
  env = process.env,
  importer = defaultImporter,
} = {}) {
  const moduleName = readModuleName(env);

  try {
    const importedModule = await importer(moduleName);
    const { RoomClass, roomClassExportShape } =
      resolveRoomClass(importedModule);

    if (typeof RoomClass !== "function") {
      return buildModuleShapeResult({
        ok: false,
        moduleName,
        importOk: true,
        roomClassExportShape,
        reasonCode: "pionero_room_client_room_class_missing",
      });
    }

    const instance = instantiateRoomClass(RoomClass);
    const connectMethodExpected = hasMethod(RoomClass, instance, "connect");
    const disconnectMethodExpected = hasMethod(
      RoomClass,
      instance,
      "disconnect"
    );
    const ok = connectMethodExpected && disconnectMethodExpected;

    return buildModuleShapeResult({
      ok,
      moduleName,
      importOk: true,
      roomClassFound: true,
      roomClassExportShape,
      connectMethodExpected,
      disconnectMethodExpected,
      reasonCode: ok ? "" : "pionero_room_client_required_methods_missing",
    });
  } catch {
    return buildModuleShapeResult({
      ok: false,
      moduleName,
      reasonCode: "pionero_room_client_module_import_failed",
    });
  }
}

async function main() {
  const result = await runPioneroRoomClientModuleShapeCheck();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

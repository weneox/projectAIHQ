import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION,
  runPioneroRoomClientModuleShapeCheck,
} from "../scripts/check-pionero-room-client-module-shape.mjs";

function unsafeEnv(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    TOKEN_TEST_VALUE: "token-secret",
    JWT_TEST_VALUE: "jwt-secret",
    RAW_AUDIO_TEST_VALUE: "rawAudio-secret",
    AUDIO_BASE64_TEST_VALUE: "audioBase64-secret",
    AUDIO_CHUNK_TEST_VALUE: "audioChunk-secret",
    PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-room-client",
    ...overrides,
  };
}

function assertNoUnsafeOutputLeak(output = {}) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
}

function assertPassingShape(result, roomClassExportShape) {
  assert.deepEqual(result, {
    ok: true,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION,
    moduleName: "fake-livekit-room-client",
    importOk: true,
    roomClassFound: true,
    roomClassExportShape,
    connectMethodExpected: true,
    disconnectMethodExpected: true,
    reasonCode: "",
  });
  assertNoUnsafeOutputLeak(result);
}

test("pionero room client module shape accepts named Room export", async () => {
  class FakeRoom {
    connect() {}
    disconnect() {}
  }

  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv(),
    importer: async (moduleName) => {
      assert.equal(moduleName, "fake-livekit-room-client");
      return { Room: FakeRoom };
    },
  });

  assertPassingShape(result, "named.Room");
});

test("pionero room client module shape accepts default.Room export", async () => {
  class FakeRoom {
    connect() {}
    disconnect() {}
  }

  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv(),
    importer: async () => ({ default: { Room: FakeRoom } }),
  });

  assertPassingShape(result, "default.Room");
});

test("pionero room client module shape accepts default function export", async () => {
  class FakeRoom {
    connect() {}
    disconnect() {}
  }

  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv(),
    importer: async () => ({ default: FakeRoom }),
  });

  assertPassingShape(result, "default");
});

test("pionero room client module shape returns safe JSON on import failure", async () => {
  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv(),
    importer: async () => {
      throw new Error(
        "missing token secret jwt apiKey apiSecret rawAudio audioBase64 audioChunk"
      );
    },
  });

  assert.deepEqual(result, {
    ok: false,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION,
    moduleName: "fake-livekit-room-client",
    importOk: false,
    roomClassFound: false,
    roomClassExportShape: "missing",
    connectMethodExpected: false,
    disconnectMethodExpected: false,
    reasonCode: "pionero_room_client_module_import_failed",
  });
  assertNoUnsafeOutputLeak(result);
});

test("pionero room client module shape returns safe JSON for missing RoomClass", async () => {
  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv(),
    importer: async () => ({ default: {} }),
  });

  assert.deepEqual(result, {
    ok: false,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION,
    moduleName: "fake-livekit-room-client",
    importOk: true,
    roomClassFound: false,
    roomClassExportShape: "missing",
    connectMethodExpected: false,
    disconnectMethodExpected: false,
    reasonCode: "pionero_room_client_room_class_missing",
  });
  assertNoUnsafeOutputLeak(result);
});

test("pionero room client module shape fails safely when methods are missing", async () => {
  class FakeRoom {
    connect() {}
  }

  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv(),
    importer: async () => ({ Room: FakeRoom }),
  });

  assert.deepEqual(result, {
    ok: false,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_MODULE_SHAPE_VERSION,
    moduleName: "fake-livekit-room-client",
    importOk: true,
    roomClassFound: true,
    roomClassExportShape: "named.Room",
    connectMethodExpected: true,
    disconnectMethodExpected: false,
    reasonCode: "pionero_room_client_required_methods_missing",
  });
  assertNoUnsafeOutputLeak(result);
});

test("pionero room client module shape redacts unsafe module names", async () => {
  const result = await runPioneroRoomClientModuleShapeCheck({
    env: unsafeEnv({
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE:
        "token-secret-jwt-apiKey-apiSecret-rawAudio-audioBase64-audioChunk",
    }),
    importer: async () => {
      throw new Error(
        "missing token secret jwt apiKey apiSecret rawAudio audioBase64 audioChunk"
      );
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.moduleName, "[redacted]");
  assert.equal(result.reasonCode, "pionero_room_client_module_import_failed");
  assertNoUnsafeOutputLeak(result);
});

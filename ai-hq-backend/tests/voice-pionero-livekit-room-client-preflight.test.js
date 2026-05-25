import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_LIVEKIT_ROOM_CLIENT_PREFLIGHT_VERSION,
  runPioneroLiveKitRoomClientPreflight,
} from "../scripts/check-pionero-livekit-room-client.mjs";

function unsafeEnv(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    TOKEN_TEST_VALUE: "token-secret",
    JWT_TEST_VALUE: "jwt-secret",
    RAW_AUDIO_TEST_VALUE: "rawAudio-secret",
    AUDIO_BASE64_TEST_VALUE: "audioBase64-secret",
    AUDIO_CHUNK_TEST_VALUE: "audioChunk-secret",
    ...overrides,
  };
}

function assertNoUnsafeOutputLeak(output = {}) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes("token-secret"), false);
  assert.equal(serialized.includes("apiKey-secret"), false);
  assert.equal(serialized.includes("apiSecret-secret"), false);
  assert.equal(serialized.includes("jwt-secret"), false);
  assert.equal(serialized.includes("rawAudio-secret"), false);
  assert.equal(serialized.includes("audioBase64-secret"), false);
  assert.equal(serialized.includes("audioChunk-secret"), false);
  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
}

test("pionero room client preflight returns safe disabled JSON without importing", async () => {
  let importerCalled = false;

  const result = await runPioneroLiveKitRoomClientPreflight({
    env: unsafeEnv({
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-room-client",
    }),
    importer: async () => {
      importerCalled = true;
      throw new Error("importer should not be called");
    },
  });

  assert.deepEqual(result, {
    ok: true,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_PREFLIGHT_VERSION,
    enabled: false,
    moduleName: "fake-livekit-room-client",
    available: false,
    roomClassFound: false,
    reasonCode: "pionero_livekit_room_client_disabled",
  });
  assert.equal(importerCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero room client preflight returns available for fake Room module", async () => {
  class FakeRoom {}

  const result = await runPioneroLiveKitRoomClientPreflight({
    env: unsafeEnv({
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "true",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "fake-livekit-room-client",
    }),
    importer: async (moduleName) => {
      assert.equal(moduleName, "fake-livekit-room-client");
      return { Room: FakeRoom };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_PREFLIGHT_VERSION,
    enabled: true,
    moduleName: "fake-livekit-room-client",
    available: true,
    roomClassFound: true,
    reasonCode: "",
  });
  assertNoUnsafeOutputLeak(result);
});

test("pionero room client preflight returns safe unavailable JSON for missing module", async () => {
  const result = await runPioneroLiveKitRoomClientPreflight({
    env: unsafeEnv({
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "missing-livekit-room-client",
    }),
    importer: async () => {
      throw new Error(
        "missing token-secret apiKey-secret apiSecret-secret jwt-secret rawAudio-secret audioBase64-secret audioChunk-secret"
      );
    },
  });

  assert.deepEqual(result, {
    ok: false,
    version: PIONERO_LIVEKIT_ROOM_CLIENT_PREFLIGHT_VERSION,
    enabled: true,
    moduleName: "missing-livekit-room-client",
    available: false,
    roomClassFound: false,
    reasonCode: "pionero_livekit_room_client_unavailable",
  });
  assertNoUnsafeOutputLeak(result);
});

test("pionero room client preflight redacts unsafe module names", async () => {
  const result = await runPioneroLiveKitRoomClientPreflight({
    env: unsafeEnv({
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_MODULE: "jwt-token-secret-module",
    }),
    importer: async () => ({ default: {} }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.moduleName, "[redacted]");
  assert.equal(result.reasonCode, "pionero_livekit_room_client_unavailable");
  assertNoUnsafeOutputLeak(result);
});

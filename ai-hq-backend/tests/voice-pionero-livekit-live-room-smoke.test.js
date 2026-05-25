import test from "node:test";
import assert from "node:assert/strict";

import {
  PIONERO_LIVEKIT_LIVE_ROOM_SMOKE_VERSION,
  runPioneroLiveKitLiveRoomSmoke,
} from "../scripts/smoke-pionero-livekit-room.mjs";

const LIVEKIT_CREDENTIAL_ID_ENV = ["LIVEKIT", "API", "KEY"].join("_");
const LIVEKIT_CREDENTIAL_PROOF_ENV = ["LIVEKIT", "API", "SECRET"].join("_");

function unsafeEnv(overrides = {}) {
  return {
    LIVEKIT_URL: "wss://livekit.example.test",
    [LIVEKIT_CREDENTIAL_ID_ENV]: "credential-id-placeholder",
    [LIVEKIT_CREDENTIAL_PROOF_ENV]: "credential-proof-placeholder",
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

  assert.equal(serialized.includes("token"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
  assert.equal(serialized.includes("token-secret"), false);
  assert.equal(serialized.includes("apiKey-secret"), false);
  assert.equal(serialized.includes("apiSecret-secret"), false);
  assert.equal(serialized.includes("jwt-secret"), false);
  assert.equal(serialized.includes("rawAudio-secret"), false);
  assert.equal(serialized.includes("audioBase64-secret"), false);
  assert.equal(serialized.includes("audioChunk-secret"), false);
}

test("pionero live room smoke skips when live smoke flag is disabled", async () => {
  let factoryCalled = false;

  const result = await runPioneroLiveKitLiveRoomSmoke({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
    }),
    roomClassFactory: async () => {
      factoryCalled = true;
      return null;
    },
  });

  assert.deepEqual(result, {
    ok: true,
    version: PIONERO_LIVEKIT_LIVE_ROOM_SMOKE_VERSION,
    skipped: true,
    networkIo: false,
    status: "",
    stopStatus: "",
    roomName: "aihq-pionero-live-smoke",
    agentIdentity: "",
    reasonCode: "pionero_livekit_live_smoke_disabled",
    audioIngestStatus: "",
    sttStatus: "",
    llmStatus: "",
    ttsStatus: "",
  });
  assert.equal(factoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live room smoke skips when room client flag is disabled", async () => {
  let factoryCalled = false;

  const result = await runPioneroLiveKitLiveRoomSmoke({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "0",
    }),
    roomClassFactory: async () => {
      factoryCalled = true;
      return null;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "pionero_livekit_room_client_disabled");
  assert.equal(factoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live room smoke reports missing config with booleans only", async () => {
  let factoryCalled = false;

  const result = await runPioneroLiveKitLiveRoomSmoke({
    env: {
      PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED: "true",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      TOKEN_TEST_VALUE: "token-secret",
      JWT_TEST_VALUE: "jwt-secret",
      RAW_AUDIO_TEST_VALUE: "rawAudio-secret",
      AUDIO_BASE64_TEST_VALUE: "audioBase64-secret",
      AUDIO_CHUNK_TEST_VALUE: "audioChunk-secret",
    },
    roomClassFactory: async () => {
      factoryCalled = true;
      return null;
    },
  });

  assert.deepEqual(result, {
    ok: false,
    version: PIONERO_LIVEKIT_LIVE_ROOM_SMOKE_VERSION,
    skipped: true,
    networkIo: false,
    status: "",
    stopStatus: "",
    roomName: "aihq-pionero-live-smoke",
    agentIdentity: "",
    reasonCode: "livekit_config_missing",
    audioIngestStatus: "",
    sttStatus: "",
    llmStatus: "",
    ttsStatus: "",
    missing: {
      livekitUrl: true,
      livekitCredentialId: true,
      livekitCredentialProof: true,
    },
  });
  assert.equal(factoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live room smoke connects and stops fake RoomClass when double opted in", async () => {
  const connectCalls = [];
  let disconnectCalls = 0;

  class FakeRoom {
    async connect(url, token) {
      connectCalls.push({ url, token });
    }

    async disconnect() {
      disconnectCalls += 1;
    }

    on() {}

    off() {}
  }

  const result = await runPioneroLiveKitLiveRoomSmoke({
    env: unsafeEnv({
      [LIVEKIT_CREDENTIAL_ID_ENV]: "credential-id-livekit",
      [LIVEKIT_CREDENTIAL_PROOF_ENV]: "credential-proof-livekit",
      PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED: "1",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "true",
    }),
    roomClassFactory: async ({ roomName }) => {
      assert.equal(roomName, "aihq-pionero-live-smoke");
      return FakeRoom;
    },
    now: () => new Date("2026-05-25T00:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.networkIo, true);
  assert.equal(result.status, "connected");
  assert.equal(result.stopStatus, "stopped");
  assert.equal(result.roomName, "aihq-pionero-live-smoke");
  assert.equal(result.agentIdentity, "aihq-pionero-agent");
  assert.equal(result.reasonCode, "");
  assert.equal(result.audioIngestStatus, "waiting_for_audio");
  assert.equal(result.sttStatus, "idle");
  assert.equal(result.llmStatus, "planned");
  assert.equal(result.ttsStatus, "planned");
  assert.equal(connectCalls.length, 1);
  assert.equal(connectCalls[0].url, "wss://livekit.example.test");
  assert.equal(typeof connectCalls[0].token, "string");
  assert.equal(connectCalls[0].token.length > 0, true);
  assert.equal(disconnectCalls, 1);
  assertNoUnsafeOutputLeak(result);
});

test("pionero live room smoke redacts unsafe output strings", async () => {
  const result = await runPioneroLiveKitLiveRoomSmoke({
    env: unsafeEnv({
      PIONERO_LIVEKIT_LIVE_SMOKE_ENABLED: "0",
      PIONERO_LIVEKIT_ROOM_CLIENT_ENABLED: "1",
      PIONERO_LIVEKIT_LIVE_SMOKE_ROOM_NAME:
        "token-apiKey-apiSecret-jwt-rawAudio-audioBase64-audioChunk",
      PIONERO_AGENT_IDENTITY:
        "token-apiKey-apiSecret-jwt-rawAudio-audioBase64-audioChunk",
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.networkIo, false);
  assert.equal(result.roomName, "[redacted]");
  assertNoUnsafeOutputLeak(result);
});

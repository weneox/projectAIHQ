import test from "node:test";
import assert from "node:assert/strict";

import {
  createSonioxSpeechAdapter,
} from "../src/modules/voice/speech/providers/sonioxSpeechAdapter.js";
import {
  buildSonioxSpeechRuntimeConfig,
} from "../src/modules/voice/speech/providers/sonioxSpeechRuntimeConfig.js";

test("Soniox speech adapter exposes websocket runtime seam safely", () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  const adapter = createSonioxSpeechAdapter({ runtimeConfig });

  assert.equal(adapter.version, "soniox_speech_adapter.v3");
  assert.equal(adapter.provider, "soniox");
  assert.equal(adapter.configured, true);
  assert.equal(adapter.realtime.provider, "soniox");
  assert.equal(adapter.realtime.networkIo, false);
  assert.equal(adapter.realtime.canCreateSocket, false);

  const plan = adapter.buildRealtimeConnectionPlan({ stage: "stt" });

  assert.equal(plan.ok, true);
  assert.equal(plan.provider, "soniox");
  assert.equal(plan.stage, "stt");
  assert.equal(plan.networkIo, false);
  assert.equal(JSON.stringify(plan).includes("test-secret"), false);
});

test("Soniox speech adapter blocks STT websocket connect without API key", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      VOICE_LANGUAGE: "az",
    },
  });

  const adapter = createSonioxSpeechAdapter({ runtimeConfig });
  const result = await adapter.connectStt();

  assert.equal(adapter.configured, false);
  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "soniox_api_key_missing");
});

test("Soniox speech adapter creates STT socket through injected factory", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  let request = null;

  const adapter = createSonioxSpeechAdapter({
    runtimeConfig,
    now: () => "2026-01-01T00:00:00.000Z",
    socketFactory: async (nextRequest) => {
      request = nextRequest;
      return { id: "fake-stt-socket" };
    },
  });

  const result = await adapter.connectStt();

  assert.equal(adapter.realtime.canCreateSocket, true);
  assert.equal(result.ok, true);
  assert.equal(result.status, "socket_created");
  assert.equal(result.stage, "stt");
  assert.equal(result.networkIo, true);
  assert.equal(result.connectedAt, "2026-01-01T00:00:00.000Z");

  assert.equal(request.provider, "soniox");
  assert.equal(request.stage, "stt");
  assert.equal(request.headers.Authorization, "Bearer test-secret");
  assert.equal(request.handshake.language, "az");

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox speech adapter creates TTS socket with text through injected factory", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  let request = null;

  const adapter = createSonioxSpeechAdapter({
    runtimeConfig,
    now: () => "2026-01-01T00:00:00.000Z",
    socketFactory: async (nextRequest) => {
      request = nextRequest;
      return { id: "fake-tts-socket" };
    },
  });

  const result = await adapter.connectTts({
    text: "Salam, necə kömək edə bilərəm?",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "socket_created");
  assert.equal(result.stage, "tts");
  assert.equal(result.networkIo, true);

  assert.equal(request.provider, "soniox");
  assert.equal(request.stage, "tts");
  assert.equal(request.handshake.text, "Salam, necə kömək edə bilərəm?");

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

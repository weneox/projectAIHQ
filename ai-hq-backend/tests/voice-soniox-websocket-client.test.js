import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSonioxSpeechRuntimeConfig,
} from "../src/modules/voice/speech/providers/sonioxSpeechRuntimeConfig.js";
import {
  buildSonioxRealtimeConnectionPlan,
  createSonioxRealtimeWebsocketClient,
} from "../src/modules/voice/speech/providers/sonioxRealtimeWebsocketClient.js";

test("Soniox realtime websocket client blocks missing API key before socket IO", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      VOICE_LANGUAGE: "az",
    },
  });

  const client = createSonioxRealtimeWebsocketClient({ runtimeConfig });
  const result = await client.connect({ stage: "stt" });

  assert.equal(client.provider, "soniox");
  assert.equal(client.networkIo, false);
  assert.equal(client.configured, false);

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "soniox_api_key_missing");
});

test("Soniox realtime websocket client exposes safe connection plan without secret", () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  const plan = buildSonioxRealtimeConnectionPlan({
    runtimeConfig,
    stage: "tts",
    text: "Salam, necə kömək edə bilərəm?",
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.provider, "soniox");
  assert.equal(plan.stage, "tts");
  assert.equal(plan.networkIo, false);
  assert.equal(plan.language, "az");
  assert.equal(plan.text, "Salam, necə kömək edə bilərəm?");
  assert.equal(plan.authentication.configured, true);
  assert.equal(plan.authentication.value, "[redacted]");
  assert.equal(JSON.stringify(plan).includes("test-secret"), false);
});

test("Soniox realtime websocket client can create socket through injectable factory", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  let receivedRequest = null;

  const client = createSonioxRealtimeWebsocketClient({
    runtimeConfig,
    now: () => "2026-01-01T00:00:00.000Z",
    socketFactory: async (request) => {
      receivedRequest = request;
      return { id: "fake-socket" };
    },
  });

  const result = await client.connect({ stage: "stt" });

  assert.equal(client.configured, true);
  assert.equal(client.canCreateSocket, true);

  assert.equal(result.ok, true);
  assert.equal(result.status, "socket_created");
  assert.equal(result.networkIo, true);
  assert.equal(result.socketCreated, true);
  assert.equal(result.connectedAt, "2026-01-01T00:00:00.000Z");

  assert.equal(receivedRequest.provider, "soniox");
  assert.equal(receivedRequest.stage, "stt");
  assert.equal(receivedRequest.headers.Authorization, "Bearer test-secret");
  assert.equal(receivedRequest.handshake.language, "az");

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox realtime websocket client reports socket factory failure safely", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  const client = createSonioxRealtimeWebsocketClient({
    runtimeConfig,
    socketFactory: async () => {
      throw new Error("socket refused");
    },
  });

  const result = await client.connect({ stage: "tts", text: "Oldu." });

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.equal(result.networkIo, true);
  assert.equal(result.reasonCode, "soniox_socket_factory_failed");
  assert.equal(result.errorMessage, "socket refused");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

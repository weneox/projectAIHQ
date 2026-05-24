import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSonioxSpeechRuntimeConfig,
} from "../src/modules/voice/speech/providers/sonioxSpeechRuntimeConfig.js";
import {
  createSonioxRealtimeWebsocketClient,
} from "../src/modules/voice/speech/providers/sonioxRealtimeWebsocketClient.js";
import {
  createSonioxNodeWebsocketFactory,
} from "../src/modules/voice/speech/providers/sonioxNodeWebsocketFactory.js";

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    this.handlers = {};

    setImmediate(() => {
      this.handlers.open?.();
    });
  }

  once(event, handler) {
    this.handlers[event] = handler;
  }

  send(payload) {
    this.sent.push(payload);
  }

  close() {
    this.closed = true;
  }
}

class FailingWebSocket {
  constructor(url) {
    this.url = url;
    this.handlers = {};

    setImmediate(() => {
      this.handlers.error?.(new Error("fake websocket failure"));
    });
  }

  once(event, handler) {
    this.handlers[event] = handler;
  }

  close() {}
}

test("Soniox websocket client builds STT initial config for real factory", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  let request = null;

  const client = createSonioxRealtimeWebsocketClient({
    runtimeConfig,
    socketFactory: async (nextRequest) => {
      request = nextRequest;
      return { id: "fake-stt-socket" };
    },
  });

  const result = await client.connect({ stage: "stt" });

  assert.equal(result.ok, true);
  assert.equal(result.stage, "stt");
  assert.equal(result.networkIo, true);

  assert.equal(request.provider, "soniox");
  assert.equal(request.stage, "stt");
  assert.equal(request.initialConfig.api_key, "test-secret");
  assert.equal(request.initialConfig.model, "stt-rt-v4");
  assert.deepEqual(request.initialConfig.language_hints, ["az"]);
  assert.equal(request.initialConfig.audio_format, "pcm_s16le");
  assert.equal(request.initialConfig.sample_rate, 16000);
  assert.equal(request.initialConfig.num_channels, 1);
  assert.equal(request.initialConfig.enable_endpoint_detection, true);

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox websocket client builds TTS initial config and text request for real factory", async () => {
  const runtimeConfig = buildSonioxSpeechRuntimeConfig({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
      SONIOX_TTS_VOICE: "default",
    },
  });

  let request = null;

  const client = createSonioxRealtimeWebsocketClient({
    runtimeConfig,
    socketFactory: async (nextRequest) => {
      request = nextRequest;
      return { id: "fake-tts-socket" };
    },
  });

  const result = await client.connect({
    stage: "tts",
    text: "Salam, necə kömək edə bilərəm?",
    streamId: "stream-test",
  });

  assert.equal(result.ok, true);
  assert.equal(result.stage, "tts");
  assert.equal(result.networkIo, true);

  assert.equal(request.provider, "soniox");
  assert.equal(request.stage, "tts");
  assert.equal(request.initialConfig.api_key, "test-secret");
  assert.equal(request.initialConfig.stream_id, "stream-test");
  assert.equal(request.initialConfig.model, "tts-rt-v1");
  assert.equal(request.initialConfig.language, "az");
  assert.equal(request.initialConfig.voice, "default");
  assert.equal(request.initialConfig.audio_format, "pcm_s16le");
  assert.equal(request.initialConfig.sample_rate, 24000);

  assert.equal(request.initialTextRequest.text, "Salam, necə kömək edə bilərəm?");
  assert.equal(request.initialTextRequest.text_end, true);
  assert.equal(request.initialTextRequest.stream_id, "stream-test");

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox node websocket factory opens socket and sends initial config", async () => {
  const factory = createSonioxNodeWebsocketFactory({
    WebSocketImpl: FakeWebSocket,
    connectTimeoutMs: 100,
  });

  const result = await factory({
    provider: "soniox",
    stage: "stt",
    url: "wss://example.test/stt",
    initialConfig: {
      api_key: "test-secret",
      model: "stt-rt-v4",
    },
  });

  assert.equal(result.provider, "soniox");
  assert.equal(result.stage, "stt");
  assert.equal(result.url, "wss://example.test/stt");
  assert.equal(result.networkIo, true);
  assert.equal(result.initialConfigSent, true);
  assert.equal(result.socket.url, "wss://example.test/stt");
  assert.deepEqual(JSON.parse(result.socket.sent[0]), {
    api_key: "test-secret",
    model: "stt-rt-v4",
  });
});

test("Soniox node websocket factory reports socket errors", async () => {
  const factory = createSonioxNodeWebsocketFactory({
    WebSocketImpl: FailingWebSocket,
    connectTimeoutMs: 100,
  });

  await assert.rejects(
    () =>
      factory({
        provider: "soniox",
        stage: "stt",
        url: "wss://example.test/stt",
        initialConfig: {
          api_key: "test-secret",
        },
      }),
    /fake websocket failure/
  );
});

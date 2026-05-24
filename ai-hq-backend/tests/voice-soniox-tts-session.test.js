import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  createSonioxTtsSession,
} from "../src/modules/voice/speech/providers/sonioxTtsSession.js";
import {
  buildSonioxSpeechRuntimeConfig,
} from "../src/modules/voice/speech/providers/sonioxSpeechRuntimeConfig.js";

class FakeSocket extends EventEmitter {
  constructor({ audioBase64 = "" } = {}) {
    super();
    this.sent = [];
    this.closed = false;
    this.audioBase64 = audioBase64;
  }

  send(payload) {
    this.sent.push(payload);

    const parsed = JSON.parse(payload);
    if (parsed.text) {
      setImmediate(() => {
        this.emit(
          "message",
          JSON.stringify({
            stream_id: parsed.stream_id,
            audio: this.audioBase64,
          })
        );

        this.emit(
          "message",
          JSON.stringify({
            stream_id: parsed.stream_id,
            audio_end: true,
            terminated: true,
          })
        );
      });
    }
  }

  close() {
    this.closed = true;
    this.emit("close");
  }
}

class ErrorSocket extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
  }

  send(payload) {
    this.sent.push(payload);

    setImmediate(() => {
      this.emit(
        "message",
        JSON.stringify({
          error_code: "fake_error",
          error_message: "fake tts failed",
        })
      );
    });
  }

  close() {}
}

test("Soniox TTS session blocks missing text before network IO", async () => {
  const session = createSonioxTtsSession({
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        SONIOX_API_KEY: "test-secret",
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => {
      throw new Error("should not create socket");
    },
  });

  const result = await session.synthesize({ text: "" });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "soniox_tts_text_missing");
});

test("Soniox TTS session opens socket, sends text request, and returns audio buffer", async () => {
  const audio = Buffer.from("fake-audio").toString("base64");
  const socket = new FakeSocket({ audioBase64: audio });

  let request = null;

  const session = createSonioxTtsSession({
    now: () => "2026-01-01T00:00:00.000Z",
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        SONIOX_API_KEY: "test-secret",
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async (nextRequest) => {
      request = nextRequest;
      return { socket };
    },
  });

  const result = await session.synthesize({
    text: "Salam, necə kömək edə bilərəm?",
    streamId: "stream-test",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "synthesized");
  assert.equal(result.provider, "soniox");
  assert.equal(result.stage, "tts");
  assert.equal(result.networkIo, true);
  assert.equal(result.audio.toString("utf8"), "fake-audio");
  assert.equal(result.audioChunkCount, 1);
  assert.equal(result.audioByteLength, 10);
  assert.equal(result.synthesizedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(socket.closed, true);

  assert.equal(request.stage, "tts");
  assert.equal(request.initialConfig.api_key, "test-secret");
  assert.equal(request.initialConfig.model, "tts-rt-v1");
  assert.equal(request.initialTextRequest.text, "Salam, necə kömək edə bilərəm?");
  assert.equal(request.initialTextRequest.stream_id, "stream-test");

  const sentTextRequest = JSON.parse(socket.sent[0]);
  assert.equal(sentTextRequest.text, "Salam, necə kömək edə bilərəm?");
  assert.equal(sentTextRequest.text_end, true);
  assert.equal(sentTextRequest.stream_id, "stream-test");

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox TTS session reports provider audio errors safely", async () => {
  const socket = new ErrorSocket();

  const session = createSonioxTtsSession({
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        SONIOX_API_KEY: "test-secret",
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => ({ socket }),
  });

  const result = await session.synthesize({
    text: "Salam",
    streamId: "stream-error",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.equal(result.networkIo, true);
  assert.equal(result.reasonCode, "soniox_tts_session_failed");
  assert.equal(result.errorMessage, "fake tts failed");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox TTS session blocks missing API key through realtime client", async () => {
  const session = createSonioxTtsSession({
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => {
      throw new Error("should not create socket");
    },
  });

  const result = await session.synthesize({ text: "Salam" });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "soniox_api_key_missing");
});

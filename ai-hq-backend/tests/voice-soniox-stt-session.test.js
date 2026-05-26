import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  createSonioxSttSession,
} from "../src/modules/voice/speech/providers/sonioxSttSession.js";
import {
  buildSonioxSpeechRuntimeConfig,
} from "../src/modules/voice/speech/providers/sonioxSpeechRuntimeConfig.js";

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
    this.closed = false;
  }

  send(payload) {
    this.sent.push(payload);

    if (Buffer.isBuffer(payload)) {
      setImmediate(() => {
        this.emit(
          "message",
          JSON.stringify({
            tokens: [
              { text: "Salam", is_final: true },
              { text: " dünya", is_final: true },
            ],
            finished: true,
            final_audio_proc_ms: 100,
            total_audio_proc_ms: 120,
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

    if (Buffer.isBuffer(payload)) {
      setImmediate(() => {
        this.emit(
          "message",
          JSON.stringify({
            error_code: "fake_stt_error",
            error_message: "fake stt failed",
          })
        );
      });
    }
  }

  close() {}
}

test("Soniox STT session blocks missing audio before network IO", async () => {
  const session = createSonioxSttSession({
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

  const result = await session.transcribe({ audioChunks: [] });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "soniox_stt_audio_missing");
});

test("Soniox STT session sends audio chunks and returns final transcript", async () => {
  const socket = new FakeSocket();

  const session = createSonioxSttSession({
    now: () => "2026-01-01T00:00:00.000Z",
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        SONIOX_API_KEY: "test-secret",
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => ({ socket }),
  });

  const result = await session.transcribe({
    audioChunks: [Buffer.from("fake-audio")],
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "transcribed");
  assert.equal(result.provider, "soniox");
  assert.equal(result.stage, "stt");
  assert.equal(result.networkIo, true);
  assert.equal(result.text, "Salam dünya");
  assert.equal(result.interimText, "");
  assert.equal(result.finalTokens.length, 2);
  assert.equal(result.nonFinalTokens.length, 0);
  assert.equal(result.events.length, 1);
  assert.equal(result.transcribedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(socket.closed, true);

  assert.equal(Buffer.isBuffer(socket.sent[0]), true);
  assert.deepEqual(JSON.parse(socket.sent[1]), { type: "finalize" });
  assert.equal(socket.sent[2], "");

  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox STT session sends typed array bytes and empty end-of-audio", async () => {
  const socket = new FakeSocket();
  const source = new Uint8Array([9, 1, 2, 3, 8]);

  const session = createSonioxSttSession({
    now: () => "2026-01-01T00:00:00.000Z",
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        SONIOX_API_KEY: "test-secret",
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => ({ socket }),
  });

  const result = await session.transcribe({
    audioChunks: [source.subarray(1, 4)],
    finalize: true,
  });

  assert.equal(result.ok, true);
  assert.equal(Buffer.isBuffer(socket.sent[0]), true);
  assert.deepEqual([...socket.sent[0]], [1, 2, 3]);
  assert.deepEqual(JSON.parse(socket.sent[1]), { type: "finalize" });
  assert.equal(socket.sent[2], "");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox STT session reports provider transcript errors safely", async () => {
  const socket = new ErrorSocket();

  const session = createSonioxSttSession({
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        SONIOX_API_KEY: "test-secret",
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => ({ socket }),
  });

  const result = await session.transcribe({
    audioChunks: [Buffer.from("bad-audio")],
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.equal(result.networkIo, true);
  assert.equal(result.reasonCode, "soniox_stt_session_failed");
  assert.equal(result.errorMessage, "fake stt failed");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Soniox STT session blocks missing API key through realtime client", async () => {
  const session = createSonioxSttSession({
    runtimeConfig: buildSonioxSpeechRuntimeConfig({
      env: {
        VOICE_LANGUAGE: "az",
      },
    }),
    socketFactory: async () => {
      throw new Error("should not create socket");
    },
  });

  const result = await session.transcribe({
    audioChunks: [Buffer.from("fake-audio")],
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.networkIo, false);
  assert.equal(result.reasonCode, "soniox_api_key_missing");
});

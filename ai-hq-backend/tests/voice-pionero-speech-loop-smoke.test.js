import test from "node:test";
import assert from "node:assert/strict";

import {
  runPioneroSpeechLoopSmoke,
} from "../scripts/smoke-pionero-speech-loop.mjs";

function smokeEnv(overrides = {}) {
  return {
    PIONERO_SPEECH_LOOP_SMOKE_ENABLED: "1",
    SONIOX_API_KEY: "soniox-key-placeholder",
    SONIOX_TTS_VOICE: "voice-test",
    SONIOX_TTS_MODEL: "tts-test",
    OPENAI_API_KEY: "openai-key-placeholder",
    PIONERO_OPENAI_MODEL: "gpt-test",
    TOKEN_TEST_VALUE: "FIXTURE-fixture",
    JWT_TEST_VALUE: "jwt-fixture",
    RAW_AUDIO_TEST_VALUE: "rawAudio-fixture",
    AUDIO_BASE64_TEST_VALUE: "audioBase64-fixture",
    AUDIO_CHUNK_TEST_VALUE: "audioChunk-fixture",
    ...overrides,
  };
}

function assertNoUnsafeOutputLeak(output = {}) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes("FIXTURE"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("apiSecret"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("rawAudio"), false);
  assert.equal(serialized.includes("audioBase64"), false);
  assert.equal(serialized.includes("audioChunk"), false);
  assert.equal(serialized.includes("FIXTURE-fixture"), false);
  assert.equal(serialized.includes("apiKey-fixture"), false);
  assert.equal(serialized.includes("apiSecret-fixture"), false);
  assert.equal(serialized.includes("jwt-fixture"), false);
  assert.equal(serialized.includes("rawAudio-fixture"), false);
  assert.equal(serialized.includes("audioBase64-fixture"), false);
  assert.equal(serialized.includes("audioChunk-fixture"), false);
  assert.equal(serialized.includes("soniox-key-placeholder"), false);
  assert.equal(serialized.includes("openai-key-placeholder"), false);
}

test("pionero speech loop smoke skips safely when disabled", async () => {
  let ttsFactoryCalled = false;
  let sttFactoryCalled = false;
  let llmFactoryCalled = false;

  const result = await runPioneroSpeechLoopSmoke({
    env: smokeEnv({
      PIONERO_SPEECH_LOOP_SMOKE_ENABLED: "0",
    }),
    createTtsSession: async () => {
      ttsFactoryCalled = true;
      return null;
    },
    createSttSession: async () => {
      sttFactoryCalled = true;
      return null;
    },
    createLlmTurnComposer: async () => {
      llmFactoryCalled = true;
      return null;
    },
  });

  assert.deepEqual(result, {
    ok: true,
    status: "skipped",
    ttsSeedStatus: "",
    ttsSeedAudioByteLength: 0,
    sttStatus: "",
    transcriptObserved: false,
    transcriptPreview: "",
    llmStatus: "",
    llmNetworkIo: false,
    responsePreview: "",
    ttsFinalStatus: "",
    ttsFinalAudioByteLength: 0,
    reasonCode: "pionero_speech_loop_smoke_disabled",
  });
  assert.equal(ttsFactoryCalled, false);
  assert.equal(sttFactoryCalled, false);
  assert.equal(llmFactoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero speech loop smoke fails safely when Soniox key is missing", async () => {
  let ttsFactoryCalled = false;

  const result = await runPioneroSpeechLoopSmoke({
    env: smokeEnv({
      SONIOX_API_KEY: "",
    }),
    createTtsSession: async () => {
      ttsFactoryCalled = true;
      return null;
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.reasonCode, "soniox_api_key_missing");
  assert.equal(result.ttsSeedStatus, "");
  assert.equal(result.sttStatus, "");
  assert.equal(ttsFactoryCalled, false);
  assertNoUnsafeOutputLeak(result);
});

test("pionero speech loop smoke runs happy path with fake TTS STT and LLM sessions", async () => {
  const seedAudio = Buffer.from([1, 2, 3, 4]);
  const finalAudio = Buffer.from([5, 6, 7, 8, 9]);
  const synthesizeCalls = [];
  let transcribeCalled = false;
  let composeCalled = false;

  const result = await runPioneroSpeechLoopSmoke({
    env: smokeEnv({
      PIONERO_SPEECH_LOOP_SMOKE_TEXT: "Salam, test yoxlamasidir.",
    }),
    createTtsSession: async ({ runtimeConfig }) => {
      assert.equal(runtimeConfig.configured, true);
      assert.equal(runtimeConfig.tts.voice, "voice-test");
      assert.equal(runtimeConfig.tts.model, "tts-test");

      return {
        async synthesize(input = {}) {
          synthesizeCalls.push(input);
          const audio = synthesizeCalls.length === 1 ? seedAudio : finalAudio;

          return {
            ok: true,
            status: "synthesized",
            audio,
            audioByteLength: audio.byteLength,
          };
        },
      };
    },
    createSttSession: async ({ runtimeConfig }) => {
      assert.equal(runtimeConfig.configured, true);

      return {
        async transcribe({ audioChunks = [], finalize = false } = {}) {
          transcribeCalled = true;
          assert.equal(finalize, true);
          assert.equal(audioChunks.length, 1);
          assert.equal(Buffer.compare(audioChunks[0], seedAudio), 0);

          return {
            ok: true,
            status: "transcribed",
            text: "Bir iki uc.",
          };
        },
      };
    },
    createLlmTurnComposer: async ({ runtimeConfig }) => {
      assert.equal(runtimeConfig.configured, true);
      assert.equal(runtimeConfig.enabled, true);
      assert.equal(runtimeConfig.model, "gpt-test");

      return {
        async composeTurn({ transcript } = {}) {
          composeCalled = true;
          assert.equal(transcript, "Bir iki uc.");

          return {
            ok: true,
            status: "composed",
            networkIo: true,
            responseText: "Salam, size komek edirem.",
          };
        },
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.equal(result.ttsSeedStatus, "synthesized");
  assert.equal(result.ttsSeedAudioByteLength, seedAudio.byteLength);
  assert.equal(result.sttStatus, "transcribed");
  assert.equal(result.transcriptObserved, true);
  assert.equal(result.transcriptPreview, "Bir iki uc.");
  assert.equal(result.llmStatus, "composed");
  assert.equal(result.llmNetworkIo, true);
  assert.equal(result.responsePreview, "Salam, size komek edirem.");
  assert.equal(result.ttsFinalStatus, "synthesized");
  assert.equal(result.ttsFinalAudioByteLength, finalAudio.byteLength);
  assert.equal(result.reasonCode, "");
  assert.equal(transcribeCalled, true);
  assert.equal(composeCalled, true);
  assert.equal(synthesizeCalls.length, 2);
  assert.equal(synthesizeCalls[0].text, "Salam, test yoxlamasidir.");
  assert.equal(synthesizeCalls[0].streamId, "pionero-speech-loop-seed");
  assert.equal(synthesizeCalls[1].text, "Salam, size komek edirem.");
  assert.equal(synthesizeCalls[1].streamId, "pionero-speech-loop-final");
  assertNoUnsafeOutputLeak(result);
});

test("pionero speech loop smoke output does not leak secrets or raw audio markers", async () => {
  const unsafeText =
    "FIXTURE apiKey apiSecret jwt rawAudio audioBase64 audioChunk";

  const result = await runPioneroSpeechLoopSmoke({
    env: smokeEnv({
      TOKEN_TEST_VALUE: "FIXTURE-fixture",
      API_KEY_TEST_VALUE: "apiKey-fixture",
      PIONERO_SMOKE_FIXTURE_VALUE: "apiSecret-fixture",
      JWT_TEST_VALUE: "jwt-fixture",
      RAW_AUDIO_TEST_VALUE: "rawAudio-fixture",
      AUDIO_BASE64_TEST_VALUE: "audioBase64-fixture",
      AUDIO_CHUNK_TEST_VALUE: "audioChunk-fixture",
    }),
    createTtsSession: async () => ({
      async synthesize() {
        return {
          ok: true,
          status: "synthesized",
          audio: Buffer.from([1, 2, 3]),
          audioByteLength: 3,
          rawAudio: "rawAudio-fixture",
          audioBase64: "audioBase64-fixture",
          audioChunk: "audioChunk-fixture",
          FIXTURE: "FIXTURE-fixture",
        };
      },
    }),
    createSttSession: async () => ({
      async transcribe() {
        return {
          ok: true,
          status: "transcribed",
          text: unsafeText,
          rawAudio: "rawAudio-fixture",
        };
      },
    }),
    createLlmTurnComposer: async () => ({
      async composeTurn() {
        return {
          ok: true,
          status: "composed",
          networkIo: true,
          responseText: unsafeText,
          apiKey: "apiKey-fixture",
        };
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.transcriptPreview, "[redacted]");
  assert.equal(result.responsePreview, "[redacted]");
  assertNoUnsafeOutputLeak(result);
});

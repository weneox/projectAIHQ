import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSonioxSpeechRuntimeConfig,
  DEFAULT_SONIOX_STT_WEBSOCKET_URL,
  DEFAULT_SONIOX_TTS_WEBSOCKET_URL,
} from "../src/modules/voice/speech/providers/sonioxSpeechRuntimeConfig.js";
import {
  createSonioxSpeechAdapter,
} from "../src/modules/voice/speech/providers/sonioxSpeechAdapter.js";

test("Soniox speech runtime config requires API key but keeps defaults stable", () => {
  const config = buildSonioxSpeechRuntimeConfig({
    env: {
      VOICE_LANGUAGE: "az",
    },
  });

  assert.equal(config.provider, "soniox");
  assert.equal(config.configured, false);
  assert.equal(config.reasonCode, "soniox_api_key_missing");
  assert.equal(config.language, "az");
  assert.equal(config.stt.websocketUrl, DEFAULT_SONIOX_STT_WEBSOCKET_URL);
  assert.equal(config.tts.websocketUrl, DEFAULT_SONIOX_TTS_WEBSOCKET_URL);
});

test("Soniox speech adapter builds STT and TTS connection plans without network IO", () => {
  const adapter = createSonioxSpeechAdapter({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
      VOICE_TTS_VOICE: "default",
    },
  });

  const sttPlan = adapter.buildSttConnectionPlan();
  const ttsPlan = adapter.buildTtsConnectionPlan({
    text: "Salam, necə kömək edə bilərəm?",
  });

  assert.equal(adapter.provider, "soniox");
  assert.equal(adapter.configured, true);
  assert.equal(adapter.networkIo, false);

  assert.equal(sttPlan.ok, true);
  assert.equal(sttPlan.provider, "soniox");
  assert.equal(sttPlan.stage, "stt");
  assert.equal(sttPlan.networkIo, false);
  assert.equal(sttPlan.language, "az");

  assert.equal(ttsPlan.ok, true);
  assert.equal(ttsPlan.provider, "soniox");
  assert.equal(ttsPlan.stage, "tts");
  assert.equal(ttsPlan.networkIo, false);
  assert.equal(ttsPlan.language, "az");
  assert.equal(ttsPlan.text, "Salam, necə kömək edə bilərəm?");

  assert.equal(JSON.stringify(adapter).includes("test-secret"), false);
});

test("Soniox speech adapter returns not implemented result until real websocket runtime is added", async () => {
  const adapter = createSonioxSpeechAdapter({
    env: {
      SONIOX_API_KEY: "test-secret",
      VOICE_LANGUAGE: "az",
    },
  });

  const stt = await adapter.transcribeAudioChunk();
  const tts = await adapter.synthesizeSpeech({ text: "Oldu." });

  assert.equal(stt.ok, false);
  assert.equal(stt.networkIo, false);
  assert.equal(stt.reasonCode, "soniox_stt_network_adapter_not_implemented");

  assert.equal(tts.ok, false);
  assert.equal(tts.networkIo, false);
  assert.equal(tts.reasonCode, "soniox_tts_network_adapter_not_implemented");
});

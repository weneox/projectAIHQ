import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceTransportAdapterContract,
  normalizeVoiceTransportProvider,
} from "../src/modules/voice/adapters/voiceAdapterContracts.js";
import {
  buildVoiceSpeechAdapterContract,
} from "../src/modules/voice/adapters/speechAdapterContracts.js";

test("voice transport adapter normalizes browser lab aliases", () => {
  assert.equal(normalizeVoiceTransportProvider("browser_lab"), "browser");
  assert.equal(normalizeVoiceTransportProvider("pre-sip-browser"), "browser");

  const contract = buildVoiceTransportAdapterContract({
    provider: "browser_lab",
  });

  assert.equal(contract.provider, "browser");
  assert.equal(contract.browserLab, true);
  assert.equal(contract.productionReady, false);
  assert.equal(contract.reasonCode, "browser_voice_lab_adapter");
});

test("voice transport adapter marks livekit as production telephony-ready contract", () => {
  const contract = buildVoiceTransportAdapterContract({
    provider: "livekit",
  });

  assert.equal(contract.provider, "livekit");
  assert.equal(contract.telephony, true);
  assert.equal(contract.realtimeCapable, true);
  assert.equal(contract.requiresSipProvider, true);
  assert.equal(contract.productionReady, true);
});

test("speech adapter contract blocks browser realtime when external speech is selected", () => {
  const contract = buildVoiceSpeechAdapterContract({
    runtimeConfig: {
      speech: {
        input: { provider: "soniox" },
        output: { provider: "elevenlabs" },
      },
    },
  });

  assert.equal(contract.asr.provider, "soniox");
  assert.equal(contract.tts.provider, "elevenlabs");
  assert.equal(contract.browserRealtimeSupported, false);
  assert.equal(contract.externalSpeechAdapterRequired, true);
  assert.equal(contract.reasonCode, "external_speech_adapter_required");
});

test("speech adapter contract allows pure openai realtime browser path", () => {
  const contract = buildVoiceSpeechAdapterContract({
    runtimeConfig: {
      speech: {
        input: { provider: "openai_realtime" },
        output: { provider: "openai_realtime" },
      },
    },
  });

  assert.equal(contract.browserRealtimeSupported, true);
  assert.equal(contract.externalSpeechAdapterRequired, false);
});

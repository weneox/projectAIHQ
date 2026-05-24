import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceSpeechProviderConfig,
} from "../src/modules/voice/speech/voiceSpeechProviderConfig.js";
import {
  buildVoiceSpeechGatewayPlan,
  createVoiceSpeechGateway,
} from "../src/modules/voice/speech/voiceSpeechGateway.js";

test("voice speech provider config defaults to Soniox without hardcoding core runtime", () => {
  const config = buildVoiceSpeechProviderConfig({
    env: {
      VOICE_TRANSPORT: "browser",
      VOICE_STT_PROVIDER: "soniox",
      VOICE_TTS_PROVIDER: "soniox",
      VOICE_LANGUAGE: "az",
      VOICE_LLM_PROVIDER: "openai",
      VOICE_AGENT_MODE: "cascaded_streaming",
    },
  });

  assert.equal(config.providerAgnostic, true);
  assert.equal(config.networkIo, false);
  assert.equal(config.transport, "browser");
  assert.equal(config.language, "az");
  assert.equal(config.stt.provider, "soniox");
  assert.equal(config.tts.provider, "soniox");
  assert.equal(config.llm.provider, "openai");
  assert.equal(config.agentMode, "cascaded_streaming");
});

test("voice speech gateway builds Soniox contract plan without provider network calls", () => {
  const plan = buildVoiceSpeechGatewayPlan({
    env: {
      VOICE_TRANSPORT: "browser",
      VOICE_STT_PROVIDER: "soniox",
      VOICE_TTS_PROVIDER: "soniox",
      VOICE_LANGUAGE: "az",
      VOICE_LLM_PROVIDER: "openai",
      VOICE_AGENT_MODE: "cascaded_streaming",
    },
  });

  assert.equal(plan.providerAgnostic, true);
  assert.equal(plan.networkIo, false);
  assert.equal(plan.providerConfig.stt.provider, "soniox");
  assert.equal(plan.providerConfig.tts.provider, "soniox");
  assert.equal(plan.speechPipeline.asr.provider, "soniox");
  assert.equal(plan.speechPipeline.tts.provider, "soniox");
  assert.equal(plan.readiness.contractReady, true);
  assert.equal(plan.readiness.liveInferenceReady, false);
  assert.equal(plan.readiness.externalSpeechAdapterRequired, true);
  assert.equal(plan.readiness.reasonCode, "speech_gateway_live_inference_not_implemented");
  assert.ok(plan.stages.find((stage) => stage.name === "stt"));
  assert.ok(plan.stages.find((stage) => stage.name === "tts"));
});

test("voice speech gateway can build Azerbaijani turn output plan before real TTS", async () => {
  const gateway = createVoiceSpeechGateway({
    env: {
      VOICE_STT_PROVIDER: "soniox",
      VOICE_TTS_PROVIDER: "soniox",
      VOICE_LANGUAGE: "az",
    },
  });

  const turn = await gateway.buildTurnPlan({
    transcript: "salam rezervasiya etmək istəyirəm",
    responseText: "Oldu, başa düşdüm. Hansı tarix üçün baxım?",
  });

  assert.equal(turn.ok, true);
  assert.equal(turn.networkIo, false);
  assert.equal(turn.providerConfig.stt.provider, "soniox");
  assert.equal(turn.output.language, "az");
  assert.equal(turn.output.text, "Oldu, başa düşdüm. Hansı tarix üçün baxım?");
  assert.ok(turn.output.chunks.length >= 2);
});


test("voice speech gateway delegates STT and TTS to configured adapter runtime", async () => {
  let sttInput = null;
  let ttsInput = null;

  const gateway = createVoiceSpeechGateway({
    env: {
      VOICE_STT_PROVIDER: "soniox",
      VOICE_TTS_PROVIDER: "soniox",
      VOICE_LANGUAGE: "az",
    },
    adapterRegistry: {
      soniox: {
        transcribeAudioChunk: async (input) => {
          sttInput = input;
          return {
            ok: true,
            status: "transcribed",
            provider: "soniox",
            stage: "stt",
            networkIo: true,
            text: "Salam",
          };
        },
        synthesizeSpeech: async (input) => {
          ttsInput = input;
          return {
            ok: true,
            status: "synthesized",
            provider: "soniox",
            stage: "tts",
            networkIo: true,
            audio: Buffer.from("fake-audio"),
          };
        },
      },
    },
  });

  const audioChunk = Buffer.from("fake-audio");
  const stt = await gateway.transcribeAudioChunk({ audioChunk });
  const tts = await gateway.synthesizeSpeech({
    text: "Oldu.",
    streamId: "stream-test",
  });

  assert.equal(stt.ok, true);
  assert.equal(stt.status, "transcribed");
  assert.equal(stt.text, "Salam");
  assert.deepEqual(sttInput, { audioChunk });

  assert.equal(tts.ok, true);
  assert.equal(tts.status, "synthesized");
  assert.equal(tts.audio.toString("utf8"), "fake-audio");
  assert.deepEqual(ttsInput, {
    text: "Oldu.",
    streamId: "stream-test",
  });
});

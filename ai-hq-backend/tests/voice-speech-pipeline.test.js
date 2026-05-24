import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserRealtimeSessionPlan,
  normalizeBrowserVoiceName,
} from "../src/modules/voice/engine/browserRealtimeSession.js";
import {
  buildVoiceSpeechPipeline,
  buildVoiceSpeechPipelineCompatibility,
  normalizeRealtimeTranscriptionModel,
  normalizeVoiceOutputName,
  normalizeVoiceSpeechProvider,
  VOICE_SPEECH_PIPELINE_VERSION,
} from "../src/modules/voice/speech/voiceSpeechPipeline.js";

test("voice speech pipeline defaults to safe OpenAI realtime speech settings", () => {
  const pipeline = buildVoiceSpeechPipeline();

  assert.equal(pipeline.version, VOICE_SPEECH_PIPELINE_VERSION);
  assert.equal(pipeline.mode, "realtime_audio");
  assert.equal(pipeline.asr.provider, "openai_realtime");
  assert.equal(pipeline.asr.model, "gpt-4o-mini-transcribe");
  assert.equal(pipeline.tts.provider, "openai_realtime");
  assert.equal(pipeline.tts.voice, "coral");
});

test("voice speech pipeline reads explicit runtime speech config", () => {
  const pipeline = buildVoiceSpeechPipeline({
    runtimeConfig: {
      voiceSpeech: {
        input: {
          provider: "openai",
          transcriptionModel: "gpt-4o-transcribe",
        },
        output: {
          provider: "openai-realtime",
          voice: "sage",
        },
      },
    },
  });

  assert.equal(pipeline.asr.provider, "openai_realtime");
  assert.equal(pipeline.asr.model, "gpt-4o-transcribe");
  assert.equal(pipeline.tts.provider, "openai_realtime");
  assert.equal(pipeline.tts.voice, "sage");
});

test("voice speech pipeline normalizers fail closed to supported realtime values", () => {
  assert.equal(normalizeVoiceSpeechProvider("unknown-provider"), "openai_realtime");
  assert.equal(normalizeRealtimeTranscriptionModel("random-model"), "gpt-4o-mini-transcribe");
  assert.equal(normalizeVoiceOutputName("alloy"), "coral");
  assert.equal(normalizeVoiceOutputName("random-voice"), "coral");
  assert.equal(normalizeBrowserVoiceName("verse"), "coral");
});

test("browser realtime session uses speech pipeline for voice and transcription model", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    requestedVoice: "ash",
    runtimeConfig: {
      speech: {
        input: {
          transcriptionModel: "gpt-4o-transcribe",
        },
      },
    },
  });

  assert.equal(plan.voice, "ash");
  assert.equal(plan.speechPipeline.asr.model, "gpt-4o-transcribe");
  assert.equal(
    plan.clientSecretRequest.session.audio.input.transcription.model,
    "gpt-4o-transcribe"
  );
  assert.equal(plan.clientSecretRequest.session.audio.output.voice, "ash");
});


test("voice speech pipeline marks external speech providers as adapter-required", () => {
  const pipeline = buildVoiceSpeechPipeline({
    runtimeConfig: {
      speech: {
        input: {
          provider: "external_stt",
        },
        output: {
          provider: "external_tts",
        },
      },
    },
  });

  assert.equal(pipeline.asr.provider, "external_stt");
  assert.equal(pipeline.tts.provider, "external_tts");
  assert.equal(pipeline.compatibility.browserRealtimeSupported, false);
  assert.equal(pipeline.compatibility.externalSpeechAdapterRequired, true);
  assert.deepEqual(pipeline.compatibility.reasonCodes, [
    "asr_provider_requires_external_speech_adapter",
    "tts_provider_requires_external_speech_adapter",
  ]);
});

test("voice speech compatibility helper does not pretend LiveKit works inside browser realtime", () => {
  const compatibility = buildVoiceSpeechPipelineCompatibility({
    asrProvider: "livekit",
    ttsProvider: "openai_realtime",
  });

  assert.equal(compatibility.browserRealtimeSupported, false);
  assert.equal(compatibility.externalSpeechAdapterRequired, true);
  assert.deepEqual(compatibility.reasonCodes, [
    "asr_provider_requires_external_speech_adapter",
  ]);
});

test("browser realtime plan exposes speech provider compatibility", () => {
  const plan = buildBrowserRealtimeSessionPlan({
    runtimeConfig: {
      speech: {
        input: {
          provider: "external_stt",
        },
      },
    },
  });

  assert.equal(plan.speechPipeline.asr.provider, "external_stt");
  assert.equal(plan.speechPipeline.compatibility.browserRealtimeSupported, false);
  assert.equal(plan.speechPipeline.compatibility.externalSpeechAdapterRequired, true);
});


test("voice speech pipeline preserves Soniox as external speech provider", () => {
  const pipeline = buildVoiceSpeechPipeline({
    runtimeConfig: {
      speech: {
        input: {
          provider: "soniox",
          language: "az",
        },
        output: {
          provider: "soniox",
          language: "az",
          voice: "default",
        },
      },
    },
  });

  assert.equal(pipeline.asr.provider, "soniox");
  assert.equal(pipeline.tts.provider, "soniox");
  assert.equal(pipeline.language, "az");
  assert.equal(pipeline.compatibility.browserRealtimeSupported, false);
  assert.equal(pipeline.compatibility.externalSpeechAdapterRequired, true);
  assert.deepEqual(pipeline.compatibility.reasonCodes, [
    "asr_provider_requires_external_speech_adapter",
    "tts_provider_requires_external_speech_adapter",
  ]);
});

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const VOICE_SPEECH_PIPELINE_VERSION = "voice_speech_pipeline.v1";

export const VOICE_SPEECH_PROVIDERS = Object.freeze([
  "openai_realtime",
  "external_stt",
  "external_tts",
  "livekit",
]);

export const OPENAI_REALTIME_TRANSCRIPTION_MODELS = Object.freeze([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
]);

export const OPENAI_REALTIME_OUTPUT_VOICES = Object.freeze([
  "coral",
  "sage",
  "ash",
  "ballad",
]);

export const BROWSER_REALTIME_SUPPORTED_SPEECH_PROVIDERS = Object.freeze([
  "openai_realtime",
]);

export function buildVoiceSpeechPipelineCompatibility({
  asrProvider = "",
  ttsProvider = "",
} = {}) {
  const unsupportedStages = [];

  if (!BROWSER_REALTIME_SUPPORTED_SPEECH_PROVIDERS.includes(asrProvider)) {
    unsupportedStages.push({
      stage: "asr",
      provider: asrProvider,
      reasonCode: "asr_provider_requires_external_speech_adapter",
    });
  }

  if (!BROWSER_REALTIME_SUPPORTED_SPEECH_PROVIDERS.includes(ttsProvider)) {
    unsupportedStages.push({
      stage: "tts",
      provider: ttsProvider,
      reasonCode: "tts_provider_requires_external_speech_adapter",
    });
  }

  return {
    browserRealtimeSupported: unsupportedStages.length === 0,
    externalSpeechAdapterRequired: unsupportedStages.length > 0,
    unsupportedStages,
    reasonCodes: unsupportedStages.map((stage) => stage.reasonCode),
  };
}

export function readVoiceSpeechConfig(runtimeConfig = {}) {
  const realtime = obj(runtimeConfig.realtime || runtimeConfig.voiceRealtime);

  return obj(
    runtimeConfig.speech ||
      runtimeConfig.voiceSpeech ||
      runtimeConfig.speechPipeline ||
      runtimeConfig.voiceSpeechPipeline ||
      realtime.speech ||
      realtime.voiceSpeech
  );
}

export function normalizeVoiceSpeechProvider(value = "", fallback = "openai_realtime") {
  const raw = s(value, fallback).toLowerCase();

  if (raw === "openai" || raw === "gpt" || raw === "openai-realtime") {
    return "openai_realtime";
  }

  if (raw === "stt" || raw === "asr" || raw === "external-asr") {
    return "external_stt";
  }

  if (raw === "tts" || raw === "external-voice") {
    return "external_tts";
  }

  return VOICE_SPEECH_PROVIDERS.includes(raw) ? raw : fallback;
}

export function normalizeRealtimeTranscriptionModel(value = "") {
  const raw = s(value, "gpt-4o-mini-transcribe").toLowerCase();
  return OPENAI_REALTIME_TRANSCRIPTION_MODELS.includes(raw)
    ? raw
    : "gpt-4o-mini-transcribe";
}

export function normalizeVoiceOutputName(value = "") {
  const raw = s(value, "coral").toLowerCase();

  if (["alloy", "echo", "shimmer", "verse"].includes(raw)) {
    return "coral";
  }

  return OPENAI_REALTIME_OUTPUT_VOICES.includes(raw) ? raw : "coral";
}

function readInputSpeechConfig(speech = {}) {
  return obj(
    speech.input ||
      speech.asr ||
      speech.stt ||
      speech.speechToText ||
      speech.speech_to_text
  );
}

function readOutputSpeechConfig(speech = {}) {
  return obj(
    speech.output ||
      speech.tts ||
      speech.textToSpeech ||
      speech.text_to_speech
  );
}

export function buildVoiceSpeechPipeline({
  runtimeConfig = {},
  requestedVoice = "",
} = {}) {
  const speech = readVoiceSpeechConfig(runtimeConfig);
  const input = readInputSpeechConfig(speech);
  const output = readOutputSpeechConfig(speech);

  const asrProvider = normalizeVoiceSpeechProvider(
    input.provider ||
      input.asrProvider ||
      input.sttProvider ||
      speech.asrProvider ||
      speech.sttProvider ||
      speech.provider,
    "openai_realtime"
  );

  const ttsProvider = normalizeVoiceSpeechProvider(
    output.provider ||
      output.ttsProvider ||
      speech.ttsProvider ||
      speech.outputProvider ||
      speech.provider,
    "openai_realtime"
  );

  const transcriptionModel = normalizeRealtimeTranscriptionModel(
    input.transcriptionModel ||
      input.model ||
      speech.transcriptionModel ||
      speech.inputTranscriptionModel
  );

  const outputVoice = normalizeVoiceOutputName(
    requestedVoice ||
      output.voice ||
      output.voiceName ||
      speech.voice ||
      speech.outputVoice
  );

  const compatibility = buildVoiceSpeechPipelineCompatibility({
    asrProvider,
    ttsProvider,
  });

  return {
    version: VOICE_SPEECH_PIPELINE_VERSION,
    mode: "realtime_audio",
    asr: {
      provider: asrProvider,
      model: transcriptionModel,
    },
    tts: {
      provider: ttsProvider,
      voice: outputVoice,
    },
    realtime: {
      transcriptionModel,
      outputVoice,
    },
    compatibility,
  };
}

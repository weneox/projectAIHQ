function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function key(value = "", fallback = "") {
  return s(value || fallback, fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export const VOICE_SPEECH_PIPELINE_VERSION = "voice_speech_pipeline.v1";

export const VOICE_SPEECH_PROVIDERS = Object.freeze([
  "openai_realtime",
  "soniox",
  "azure",
  "google",
  "deepgram",
  "cartesia",
  "elevenlabs",
  "external_stt",
  "external_tts",
  "livekit",
  "unknown",
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
  const raw = key(value, fallback);

  if (["openai", "gpt", "openai_realtime", "openai_realtime_api"].includes(raw)) {
    return "openai_realtime";
  }

  if (["stt", "asr", "external_asr", "external_stt"].includes(raw)) {
    return "external_stt";
  }

  if (["tts", "external_voice", "external_tts"].includes(raw)) {
    return "external_tts";
  }

  if (["google_stt", "google_speech", "google_speech_to_text"].includes(raw)) {
    return "google";
  }

  if (["azure_speech", "microsoft_speech", "azure_ai_speech"].includes(raw)) {
    return "azure";
  }

  if (["soniox_stt", "soniox_tts"].includes(raw)) {
    return "soniox";
  }

  const fallbackKey = key(fallback, "openai_realtime");
  if (VOICE_SPEECH_PROVIDERS.includes(raw)) return raw;
  if (VOICE_SPEECH_PROVIDERS.includes(fallbackKey)) return fallbackKey;

  return "openai_realtime";
}

export function normalizeRealtimeTranscriptionModel(value = "") {
  const raw = s(value, "gpt-4o-mini-transcribe").toLowerCase();
  return OPENAI_REALTIME_TRANSCRIPTION_MODELS.includes(raw)
    ? raw
    : "gpt-4o-mini-transcribe";
}

export function defaultVoiceForProvider(provider = "openai_realtime") {
  const normalized = normalizeVoiceSpeechProvider(provider, "openai_realtime");

  if (normalized === "openai_realtime") return "coral";
  if (normalized === "soniox") return "default";
  if (normalized === "azure") return "default";
  if (normalized === "google") return "default";
  if (normalized === "deepgram") return "default";
  if (normalized === "cartesia") return "default";
  if (normalized === "elevenlabs") return "default";

  return "default";
}

export function normalizeVoiceOutputName(value = "", provider = "openai_realtime") {
  const normalizedProvider = normalizeVoiceSpeechProvider(provider, "openai_realtime");

  if (normalizedProvider === "openai_realtime") {
    const raw = s(value, "coral").toLowerCase();

    if (["alloy", "echo", "shimmer", "verse"].includes(raw)) {
      return "coral";
    }

    return OPENAI_REALTIME_OUTPUT_VOICES.includes(raw) ? raw : "coral";
  }

  return s(value, defaultVoiceForProvider(normalizedProvider));
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

  const language = s(
    input.language ||
      input.locale ||
      output.language ||
      output.locale ||
      speech.language ||
      speech.locale ||
      runtimeConfig.defaultLanguage ||
      runtimeConfig.language,
    "az"
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
      speech.outputVoice,
    ttsProvider
  );

  const compatibility = buildVoiceSpeechPipelineCompatibility({
    asrProvider,
    ttsProvider,
  });

  return {
    version: VOICE_SPEECH_PIPELINE_VERSION,
    mode: "realtime_audio",
    language,
    asr: {
      provider: asrProvider,
      model: transcriptionModel,
      language,
    },
    tts: {
      provider: ttsProvider,
      voice: outputVoice,
      language,
    },
    realtime: {
      transcriptionModel,
      outputVoice,
    },
    compatibility,
  };
}

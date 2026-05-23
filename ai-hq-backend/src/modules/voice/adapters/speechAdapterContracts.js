function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const VOICE_SPEECH_ADAPTER_CONTRACT_VERSION =
  "voice_speech_adapter_contract.v1";

export const VOICE_SPEECH_STAGE_PROVIDERS = Object.freeze([
  "openai_realtime",
  "external_stt",
  "external_tts",
  "soniox",
  "elevenlabs",
  "deepgram",
  "cartesia",
  "livekit",
  "unknown",
]);

export function normalizeVoiceSpeechStageProvider(value = "", fallback = "unknown") {
  const raw = s(value || fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["openai", "gpt", "openai_realtime", "openai-realtime"].includes(raw)) {
    return "openai_realtime";
  }

  if (["stt", "asr", "external_asr", "external_stt"].includes(raw)) {
    return "external_stt";
  }

  if (["tts", "external_voice", "external_tts"].includes(raw)) {
    return "external_tts";
  }

  return VOICE_SPEECH_STAGE_PROVIDERS.includes(raw) ? raw : "unknown";
}

export function buildVoiceSpeechAdapterContract({
  speechPipeline = {},
  runtimeConfig = {},
} = {}) {
  const pipeline = obj(speechPipeline);
  const runtime = obj(runtimeConfig);
  const speech = obj(runtime.speech || runtime.voiceSpeech || runtime.speechPipeline);

  const asrProvider = normalizeVoiceSpeechStageProvider(
    obj(pipeline.asr).provider ||
      obj(speech.input).provider ||
      obj(speech.asr).provider ||
      speech.asrProvider ||
      speech.sttProvider,
    "openai_realtime"
  );

  const ttsProvider = normalizeVoiceSpeechStageProvider(
    obj(pipeline.tts).provider ||
      obj(speech.output).provider ||
      obj(speech.tts).provider ||
      speech.ttsProvider ||
      speech.outputProvider,
    "openai_realtime"
  );

  const browserRealtimeSupported =
    asrProvider === "openai_realtime" && ttsProvider === "openai_realtime";

  return {
    version: VOICE_SPEECH_ADAPTER_CONTRACT_VERSION,
    asr: {
      provider: asrProvider,
      external: asrProvider !== "openai_realtime",
    },
    tts: {
      provider: ttsProvider,
      external: ttsProvider !== "openai_realtime",
    },
    browserRealtimeSupported,
    externalSpeechAdapterRequired: !browserRealtimeSupported,
    reasonCode: browserRealtimeSupported
      ? ""
      : "external_speech_adapter_required",
  };
}

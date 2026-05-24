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

export const VOICE_SPEECH_PROVIDER_CONFIG_VERSION =
  "voice_speech_provider_config.v1";

export const VOICE_SPEECH_GATEWAY_PROVIDERS = Object.freeze([
  "soniox",
  "openai_realtime",
  "azure",
  "google",
  "deepgram",
  "cartesia",
  "elevenlabs",
  "external",
  "unknown",
]);

export const VOICE_SPEECH_PROVIDER_CAPABILITIES = Object.freeze({
  soniox: {
    provider: "soniox",
    stages: ["stt", "tts"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: true,
    costProfile: "price_performance",
  },
  openai_realtime: {
    provider: "openai_realtime",
    stages: ["stt", "tts", "llm"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: false,
    costProfile: "premium",
  },
  azure: {
    provider: "azure",
    stages: ["stt", "tts"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: true,
    costProfile: "balanced",
  },
  google: {
    provider: "google",
    stages: ["stt", "tts"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: true,
    costProfile: "balanced",
  },
  deepgram: {
    provider: "deepgram",
    stages: ["stt"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: false,
    costProfile: "price_performance",
  },
  cartesia: {
    provider: "cartesia",
    stages: ["stt", "tts"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: false,
    costProfile: "premium",
  },
  elevenlabs: {
    provider: "elevenlabs",
    stages: ["tts"],
    realtimeStreaming: true,
    lowLatencyCandidate: true,
    nativeLanguageCandidate: false,
    costProfile: "premium",
  },
  external: {
    provider: "external",
    stages: ["stt", "tts"],
    realtimeStreaming: true,
    lowLatencyCandidate: false,
    nativeLanguageCandidate: false,
    costProfile: "custom",
  },
  unknown: {
    provider: "unknown",
    stages: [],
    realtimeStreaming: false,
    lowLatencyCandidate: false,
    nativeLanguageCandidate: false,
    costProfile: "unknown",
  },
});

export function normalizeVoiceSpeechGatewayProvider(value = "", fallback = "unknown") {
  const raw = key(value, fallback);

  if (["openai", "gpt", "openai_realtime", "openai_realtime_api"].includes(raw)) {
    return "openai_realtime";
  }

  if (["soniox_stt", "soniox_tts"].includes(raw)) return "soniox";
  if (["azure_speech", "microsoft_speech", "azure_ai_speech"].includes(raw)) return "azure";
  if (["google_speech", "google_stt", "google_tts"].includes(raw)) return "google";
  if (["external_stt", "external_tts", "custom", "own_model"].includes(raw)) return "external";

  const fallbackKey = key(fallback, "unknown");
  if (VOICE_SPEECH_GATEWAY_PROVIDERS.includes(raw)) return raw;
  if (VOICE_SPEECH_GATEWAY_PROVIDERS.includes(fallbackKey)) return fallbackKey;

  return "unknown";
}

export function getVoiceSpeechProviderCapabilities(provider = "") {
  const normalized = normalizeVoiceSpeechGatewayProvider(provider);
  return VOICE_SPEECH_PROVIDER_CAPABILITIES[normalized] ||
    VOICE_SPEECH_PROVIDER_CAPABILITIES.unknown;
}

function readSpeechConfig(runtimeConfig = {}) {
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

function readInputConfig(speech = {}) {
  return obj(speech.input || speech.stt || speech.asr || speech.speechToText);
}

function readOutputConfig(speech = {}) {
  return obj(speech.output || speech.tts || speech.textToSpeech);
}

export function buildVoiceSpeechProviderConfig({
  env = process.env,
  runtimeConfig = {},
  overrides = {},
} = {}) {
  const speech = readSpeechConfig(runtimeConfig);
  const input = readInputConfig(speech);
  const output = readOutputConfig(speech);

  const language = s(
    overrides.language ||
      env.VOICE_LANGUAGE ||
      env.VOICE_STT_LANGUAGE ||
      input.language ||
      input.locale ||
      speech.language ||
      runtimeConfig.defaultLanguage,
    "az"
  );

  const sttProvider = normalizeVoiceSpeechGatewayProvider(
    overrides.sttProvider ||
      env.VOICE_STT_PROVIDER ||
      input.provider ||
      input.sttProvider ||
      speech.sttProvider,
    "soniox"
  );

  const ttsProvider = normalizeVoiceSpeechGatewayProvider(
    overrides.ttsProvider ||
      env.VOICE_TTS_PROVIDER ||
      output.provider ||
      output.ttsProvider ||
      speech.ttsProvider,
    "soniox"
  );

  const transport = s(
    overrides.transport || env.VOICE_TRANSPORT || runtimeConfig.voiceTransport,
    "browser"
  ).toLowerCase();

  const llmProvider = s(
    overrides.llmProvider || env.VOICE_LLM_PROVIDER || runtimeConfig.llmProvider,
    "openai"
  ).toLowerCase();

  const agentMode = s(
    overrides.agentMode || env.VOICE_AGENT_MODE || runtimeConfig.agentMode,
    "cascaded_streaming"
  ).toLowerCase();

  const ttsVoice = s(
    overrides.ttsVoice ||
      env.VOICE_TTS_VOICE ||
      output.voice ||
      output.voiceName ||
      speech.voice,
    "default"
  );

  const sttCapabilities = getVoiceSpeechProviderCapabilities(sttProvider);
  const ttsCapabilities = getVoiceSpeechProviderCapabilities(ttsProvider);

  return {
    version: VOICE_SPEECH_PROVIDER_CONFIG_VERSION,
    providerAgnostic: true,
    networkIo: false,
    transport,
    language,
    agentMode,
    llm: {
      provider: llmProvider,
    },
    stt: {
      provider: sttProvider,
      language,
      capabilities: sttCapabilities,
      configured: sttProvider !== "unknown",
    },
    tts: {
      provider: ttsProvider,
      language,
      voice: ttsVoice,
      capabilities: ttsCapabilities,
      configured: ttsProvider !== "unknown",
    },
  };
}

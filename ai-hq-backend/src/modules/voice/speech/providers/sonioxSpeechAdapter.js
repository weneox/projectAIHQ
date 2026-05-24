import {
  buildSonioxSpeechRuntimeConfig,
} from "./sonioxSpeechRuntimeConfig.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function safeConfig(config = {}) {
  return {
    version: config.version,
    provider: "soniox",
    configured: config.configured === true,
    reasonCode: s(config.reasonCode),
    language: s(config.language, "az"),
    stt: {
      websocketUrl: s(config.stt?.websocketUrl),
      model: s(config.stt?.model, "default"),
      language: s(config.stt?.language, config.language || "az"),
      sampleRateHz: Number(config.stt?.sampleRateHz || 16000),
      interimResults: config.stt?.interimResults !== false,
    },
    tts: {
      websocketUrl: s(config.tts?.websocketUrl),
      model: s(config.tts?.model, "default"),
      language: s(config.tts?.language, config.language || "az"),
      voice: s(config.tts?.voice, "default"),
      streaming: config.tts?.streaming !== false,
    },
  };
}

export const SONIOX_SPEECH_ADAPTER_VERSION = "soniox_speech_adapter.v2";

export function createSonioxSpeechAdapter({
  env = process.env,
  apiKey = "",
  language = "az",
  voice = "default",
  sttModel = "",
  ttsModel = "",
  runtimeConfig = null,
} = {}) {
  const config =
    runtimeConfig ||
    buildSonioxSpeechRuntimeConfig({
      env,
      overrides: {
        apiKey,
        language,
        voice,
        sttModel,
        ttsModel,
      },
    });

  const publicConfig = safeConfig(config);

  return {
    version: SONIOX_SPEECH_ADAPTER_VERSION,
    provider: "soniox",
    stages: ["stt", "tts"],
    networkIo: false,
    configured: config.configured === true,
    reasonCode: s(config.reasonCode),
    language: publicConfig.language,
    config: publicConfig,

    stt: {
      provider: "soniox",
      language: publicConfig.stt.language,
      model: publicConfig.stt.model,
      websocketUrl: publicConfig.stt.websocketUrl,
      sampleRateHz: publicConfig.stt.sampleRateHz,
      interimResults: publicConfig.stt.interimResults,
      streaming: true,
    },

    tts: {
      provider: "soniox",
      language: publicConfig.tts.language,
      voice: publicConfig.tts.voice,
      model: publicConfig.tts.model,
      websocketUrl: publicConfig.tts.websocketUrl,
      streaming: true,
    },

    buildSttConnectionPlan() {
      return {
        ok: config.configured === true,
        provider: "soniox",
        stage: "stt",
        networkIo: false,
        websocketUrl: publicConfig.stt.websocketUrl,
        language: publicConfig.stt.language,
        model: publicConfig.stt.model,
        sampleRateHz: publicConfig.stt.sampleRateHz,
        interimResults: publicConfig.stt.interimResults,
        reasonCode: config.configured ? "" : "soniox_api_key_missing",
      };
    },

    buildTtsConnectionPlan({ text = "" } = {}) {
      return {
        ok: config.configured === true,
        provider: "soniox",
        stage: "tts",
        networkIo: false,
        websocketUrl: publicConfig.tts.websocketUrl,
        language: publicConfig.tts.language,
        model: publicConfig.tts.model,
        voice: publicConfig.tts.voice,
        text: s(text),
        reasonCode: config.configured ? "" : "soniox_api_key_missing",
      };
    },

    async transcribeAudioChunk() {
      return {
        ok: false,
        status: "not_implemented",
        provider: "soniox",
        stage: "stt",
        networkIo: false,
        connectionPlan: this.buildSttConnectionPlan(),
        reasonCode: "soniox_stt_network_adapter_not_implemented",
      };
    },

    async synthesizeSpeech({ text = "" } = {}) {
      return {
        ok: false,
        status: "not_implemented",
        provider: "soniox",
        stage: "tts",
        networkIo: false,
        connectionPlan: this.buildTtsConnectionPlan({ text }),
        reasonCode: "soniox_tts_network_adapter_not_implemented",
      };
    },
  };
}

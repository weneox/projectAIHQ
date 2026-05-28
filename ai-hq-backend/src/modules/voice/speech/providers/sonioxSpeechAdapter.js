import {
  buildSonioxSpeechRuntimeConfig,
} from "./sonioxSpeechRuntimeConfig.js";
import {
  createSonioxRealtimeWebsocketClient,
} from "./sonioxRealtimeWebsocketClient.js";
import {
  createSonioxSttSession,
} from "./sonioxSttSession.js";
import {
  createSonioxTtsSession,
} from "./sonioxTtsSession.js";

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

export const SONIOX_SPEECH_ADAPTER_VERSION = "soniox_speech_adapter.v3";

export function createSonioxSpeechAdapter({
  env = process.env,
  apiKey = "",
  language = "az",
  voice = "default",
  sttModel = "",
  ttsModel = "",
  runtimeConfig = null,
  socketFactory = null,
  realtimeClient = null,
  sttSession = null,
  ttsSession = null,
  now = () => new Date().toISOString(),
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
  const websocketClient =
    realtimeClient ||
    createSonioxRealtimeWebsocketClient({
      runtimeConfig: config,
      socketFactory,
      now,
    });

  const sttRuntime =
    sttSession ||
    createSonioxSttSession({
      runtimeConfig: config,
      socketFactory,
      now,
    });

  const ttsRuntime =
    ttsSession ||
    createSonioxTtsSession({
      runtimeConfig: config,
      socketFactory,
      now,
    });

  return {
    version: SONIOX_SPEECH_ADAPTER_VERSION,
    provider: "soniox",
    stages: ["stt", "tts"],
    networkIo: false,
    configured: config.configured === true,
    reasonCode: s(config.reasonCode),
    language: publicConfig.language,
    config: publicConfig,

    realtime: {
      provider: "soniox",
      available: !!websocketClient,
      canCreateSocket: websocketClient?.canCreateSocket === true,
      networkIo: false,
    },

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

    buildRealtimeConnectionPlan({ stage = "stt", text = "" } = {}) {
      return websocketClient.buildConnectionPlan({ stage, text });
    },

    async connectStt() {
      return websocketClient.connect({ stage: "stt" });
    },

    async connectTts({ text = "" } = {}) {
      return websocketClient.connect({ stage: "tts", text });
    },

    async transcribeAudioChunk(input = {}) {
      const payload =
        Buffer.isBuffer(input) || input instanceof Uint8Array || typeof input === "string"
          ? { audioChunk: input }
          : input && typeof input === "object"
            ? input
            : {};

      const audioChunks = Array.isArray(payload.audioChunks) ? payload.audioChunks : [];
      const chunks =
        audioChunks.length > 0
          ? audioChunks
          : [payload.audioChunk].filter((chunk) => chunk !== undefined && chunk !== null);

      return sttRuntime.transcribe({
        audioChunks: chunks,
        finalize: payload.finalize !== false,
      });
    },

    async synthesizeSpeech({ text = "", streamId = "" } = {}) {
      return ttsRuntime.synthesize({ text, streamId });
    },
  };
}

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

export const SONIOX_SPEECH_ADAPTER_VERSION = "soniox_speech_adapter.v1";

export function createSonioxSpeechAdapter({
  apiKey = "",
  language = "az",
  voice = "default",
  sttModel = "",
  ttsModel = "",
} = {}) {
  return {
    version: SONIOX_SPEECH_ADAPTER_VERSION,
    provider: "soniox",
    stages: ["stt", "tts"],
    networkIo: false,
    configured: !!s(apiKey),
    language: s(language, "az"),
    stt: {
      provider: "soniox",
      language: s(language, "az"),
      model: s(sttModel, "default"),
      streaming: true,
    },
    tts: {
      provider: "soniox",
      language: s(language, "az"),
      voice: s(voice, "default"),
      model: s(ttsModel, "default"),
      streaming: true,
    },
    async transcribeAudioChunk() {
      return {
        ok: false,
        status: "not_implemented",
        provider: "soniox",
        stage: "stt",
        networkIo: false,
        reasonCode: "soniox_stt_network_adapter_not_implemented",
      };
    },
    async synthesizeSpeech() {
      return {
        ok: false,
        status: "not_implemented",
        provider: "soniox",
        stage: "tts",
        networkIo: false,
        reasonCode: "soniox_tts_network_adapter_not_implemented",
      };
    },
  };
}

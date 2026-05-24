function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

export const SONIOX_SPEECH_RUNTIME_CONFIG_VERSION =
  "soniox_speech_runtime_config.v1";

export const DEFAULT_SONIOX_STT_WEBSOCKET_URL =
  "wss://stt-rt.soniox.com/transcribe-websocket";

export const DEFAULT_SONIOX_TTS_WEBSOCKET_URL =
  "wss://tts-rt.soniox.com/tts-websocket";

export function buildSonioxSpeechRuntimeConfig({
  env = process.env,
  overrides = {},
} = {}) {
  const apiKey = s(
    overrides.apiKey ||
      env.SONIOX_API_KEY ||
      env.VOICE_SONIOX_API_KEY ||
      env.SONIOX_TOKEN ||
      env.VOICE_SONIOX_TOKEN
  );

  const language = s(
    overrides.language ||
      env.VOICE_LANGUAGE ||
      env.SONIOX_LANGUAGE ||
      env.VOICE_STT_LANGUAGE,
    "az"
  );

  const sttWebsocketUrl = s(
    overrides.sttWebsocketUrl ||
      env.SONIOX_STT_WEBSOCKET_URL ||
      env.VOICE_SONIOX_STT_WEBSOCKET_URL,
    DEFAULT_SONIOX_STT_WEBSOCKET_URL
  );

  const ttsWebsocketUrl = s(
    overrides.ttsWebsocketUrl ||
      env.SONIOX_TTS_WEBSOCKET_URL ||
      env.VOICE_SONIOX_TTS_WEBSOCKET_URL,
    DEFAULT_SONIOX_TTS_WEBSOCKET_URL
  );

  const sttModel = s(
    overrides.sttModel ||
      env.SONIOX_STT_MODEL ||
      env.VOICE_STT_MODEL,
    "default"
  );

  const ttsModel = s(
    overrides.ttsModel ||
      env.SONIOX_TTS_MODEL ||
      env.VOICE_TTS_MODEL,
    "default"
  );

  const voice = s(
    overrides.voice ||
      env.SONIOX_TTS_VOICE ||
      env.VOICE_TTS_VOICE,
    "default"
  );

  const sampleRateHz = Number(
    overrides.sampleRateHz ||
      env.SONIOX_SAMPLE_RATE_HZ ||
      env.VOICE_SAMPLE_RATE_HZ ||
      16000
  );

  return {
    version: SONIOX_SPEECH_RUNTIME_CONFIG_VERSION,
    provider: "soniox",
    configured: !!apiKey,
    reasonCode: apiKey ? "" : "soniox_api_key_missing",
    apiKey,
    language,
    stt: {
      websocketUrl: sttWebsocketUrl,
      model: sttModel,
      language,
      sampleRateHz: Number.isFinite(sampleRateHz) ? sampleRateHz : 16000,
      interimResults: bool(
        overrides.interimResults ?? env.SONIOX_INTERIM_RESULTS,
        true
      ),
    },
    tts: {
      websocketUrl: ttsWebsocketUrl,
      model: ttsModel,
      language,
      voice,
      streaming: true,
    },
  };
}

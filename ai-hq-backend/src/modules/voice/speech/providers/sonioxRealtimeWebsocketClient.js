function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function cleanObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, next]) => next !== undefined && next !== "")
  );
}

export const SONIOX_REALTIME_WEBSOCKET_CLIENT_VERSION =
  "soniox_realtime_websocket_client.v2";

export const SONIOX_REALTIME_STAGES = Object.freeze(["stt", "tts"]);

export const SONIOX_DEFAULT_STT_MODEL = "stt-rt-v4";
export const SONIOX_DEFAULT_TTS_MODEL = "tts-rt-v1";

function normalizeStage(value = "") {
  const stage = s(value).toLowerCase();
  return SONIOX_REALTIME_STAGES.includes(stage) ? stage : "";
}

function redactSecret(value = "") {
  return s(value) ? "[redacted]" : "";
}

function normalizeModel(stage, value = "") {
  const model = s(value);
  if (model && model !== "default") return model;
  return stage === "tts" ? SONIOX_DEFAULT_TTS_MODEL : SONIOX_DEFAULT_STT_MODEL;
}

function buildSonioxInitialConfig({ runtimeConfig = {}, plan = {} } = {}) {
  const config = obj(runtimeConfig);
  const stage = s(plan.stage);
  const apiKey = s(config.apiKey);

  if (stage === "tts") {
    return cleanObject({
      api_key: apiKey,
      stream_id: s(plan.streamId, "stream-1"),
      model: normalizeModel("tts", plan.model),
      language: s(plan.language, "az"),
      voice: s(plan.voice, "default"),
      audio_format: "pcm_s16le",
      sample_rate: 24000,
    });
  }

  return cleanObject({
    api_key: apiKey,
    model: normalizeModel("stt", plan.model),
    language_hints: s(plan.language) ? [s(plan.language)] : undefined,
    audio_format: "pcm_s16le",
    sample_rate: n(plan.sampleRateHz, 16000),
    num_channels: 1,
    enable_endpoint_detection: true,
  });
}

function buildSonioxInitialTextRequest(plan = {}) {
  if (s(plan.stage) !== "tts" || !s(plan.text)) return null;

  return {
    text: s(plan.text),
    text_end: true,
    stream_id: s(plan.streamId, "stream-1"),
  };
}

export function buildSonioxRealtimeConnectionPlan({
  runtimeConfig = {},
  stage = "stt",
  text = "",
  streamId = "",
} = {}) {
  const config = obj(runtimeConfig);
  const normalizedStage = normalizeStage(stage);

  if (!normalizedStage) {
    return {
      ok: false,
      provider: "soniox",
      stage: "",
      networkIo: false,
      reasonCode: "soniox_realtime_stage_invalid",
    };
  }

  if (config.configured !== true || !s(config.apiKey)) {
    return {
      ok: false,
      provider: "soniox",
      stage: normalizedStage,
      networkIo: false,
      reasonCode: "soniox_api_key_missing",
    };
  }

  const stageConfig = obj(config[normalizedStage]);
  const websocketUrl = s(stageConfig.websocketUrl);

  if (!websocketUrl) {
    return {
      ok: false,
      provider: "soniox",
      stage: normalizedStage,
      networkIo: false,
      reasonCode: "soniox_websocket_url_missing",
    };
  }

  return {
    ok: true,
    provider: "soniox",
    stage: normalizedStage,
    networkIo: false,
    websocketUrl,
    authentication: {
      type: "api_key_config_message",
      configured: true,
      value: redactSecret(config.apiKey),
    },
    language: s(stageConfig.language, config.language || "az"),
    model: normalizeModel(normalizedStage, stageConfig.model),
    voice: normalizedStage === "tts" ? s(stageConfig.voice, "default") : "",
    sampleRateHz:
      normalizedStage === "stt"
        ? n(stageConfig.sampleRateHz, 16000)
        : undefined,
    interimResults:
      normalizedStage === "stt"
        ? stageConfig.interimResults !== false
        : undefined,
    streamId: normalizedStage === "tts" ? s(streamId, "stream-1") : "",
    text: normalizedStage === "tts" ? s(text) : "",
    reasonCode: "",
  };
}

function buildPrivateSocketRequest({ runtimeConfig = {}, plan = {} } = {}) {
  const initialConfig = buildSonioxInitialConfig({ runtimeConfig, plan });
  const initialTextRequest = buildSonioxInitialTextRequest(plan);

  return {
    provider: "soniox",
    stage: s(plan.stage),
    url: s(plan.websocketUrl),
    headers: {
      Authorization: `Bearer ${s(runtimeConfig.apiKey)}`,
    },
    initialConfig,
    initialTextRequest,
    handshake: {
      provider: "soniox",
      stage: s(plan.stage),
      language: s(plan.language),
      model: s(plan.model),
      voice: s(plan.voice),
      sampleRateHz: plan.sampleRateHz,
      interimResults: plan.interimResults,
      streamId: s(plan.streamId),
      text: s(plan.text),
    },
  };
}

export function createSonioxRealtimeWebsocketClient({
  runtimeConfig = {},
  socketFactory = null,
  now = () => new Date().toISOString(),
} = {}) {
  const config = obj(runtimeConfig);
  const canCreateSocket = typeof socketFactory === "function";

  return {
    version: SONIOX_REALTIME_WEBSOCKET_CLIENT_VERSION,
    provider: "soniox",
    networkIo: false,
    configured: config.configured === true && !!s(config.apiKey),
    canCreateSocket,

    buildConnectionPlan({ stage = "stt", text = "", streamId = "" } = {}) {
      return buildSonioxRealtimeConnectionPlan({
        runtimeConfig: config,
        stage,
        text,
        streamId,
      });
    },

    async connect({ stage = "stt", text = "", streamId = "" } = {}) {
      const connectionPlan = this.buildConnectionPlan({ stage, text, streamId });

      if (!connectionPlan.ok) {
        return {
          ok: false,
          status: "blocked",
          provider: "soniox",
          stage: s(connectionPlan.stage || stage),
          networkIo: false,
          reasonCode: s(connectionPlan.reasonCode),
          connectionPlan,
        };
      }

      if (!canCreateSocket) {
        return {
          ok: false,
          status: "not_implemented",
          provider: "soniox",
          stage: connectionPlan.stage,
          networkIo: false,
          reasonCode: "soniox_socket_factory_missing",
          connectionPlan,
        };
      }

      try {
        const privateRequest = buildPrivateSocketRequest({
          runtimeConfig: config,
          plan: connectionPlan,
        });

        const socket = await socketFactory(privateRequest);

        return {
          ok: true,
          status: "socket_created",
          provider: "soniox",
          stage: connectionPlan.stage,
          networkIo: true,
          socketCreated: !!socket,
          connectedAt: now(),
          reasonCode: "",
          connectionPlan,
        };
      } catch (err) {
        return {
          ok: false,
          status: "failed",
          provider: "soniox",
          stage: connectionPlan.stage,
          networkIo: true,
          reasonCode: "soniox_socket_factory_failed",
          errorMessage: s(err?.message || err),
          connectionPlan,
        };
      }
    },
  };
}

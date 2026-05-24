function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const SONIOX_REALTIME_WEBSOCKET_CLIENT_VERSION =
  "soniox_realtime_websocket_client.v1";

export const SONIOX_REALTIME_STAGES = Object.freeze(["stt", "tts"]);

function normalizeStage(value = "") {
  const stage = s(value).toLowerCase();
  return SONIOX_REALTIME_STAGES.includes(stage) ? stage : "";
}

function redactSecret(value = "") {
  return s(value) ? "[redacted]" : "";
}

export function buildSonioxRealtimeConnectionPlan({
  runtimeConfig = {},
  stage = "stt",
  text = "",
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
      type: "api_key",
      configured: true,
      value: redactSecret(config.apiKey),
    },
    language: s(stageConfig.language, config.language || "az"),
    model: s(stageConfig.model, "default"),
    voice: normalizedStage === "tts" ? s(stageConfig.voice, "default") : "",
    sampleRateHz:
      normalizedStage === "stt"
        ? Number(stageConfig.sampleRateHz || 16000)
        : undefined,
    interimResults:
      normalizedStage === "stt"
        ? stageConfig.interimResults !== false
        : undefined,
    text: normalizedStage === "tts" ? s(text) : "",
    reasonCode: "",
  };
}

function buildPrivateSocketRequest({ runtimeConfig = {}, plan = {} } = {}) {
  return {
    provider: "soniox",
    stage: s(plan.stage),
    url: s(plan.websocketUrl),
    headers: {
      Authorization: `Bearer ${s(runtimeConfig.apiKey)}`,
    },
    handshake: {
      provider: "soniox",
      stage: s(plan.stage),
      language: s(plan.language),
      model: s(plan.model),
      voice: s(plan.voice),
      sampleRateHz: plan.sampleRateHz,
      interimResults: plan.interimResults,
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

    buildConnectionPlan({ stage = "stt", text = "" } = {}) {
      return buildSonioxRealtimeConnectionPlan({
        runtimeConfig: config,
        stage,
        text,
      });
    },

    async connect({ stage = "stt", text = "" } = {}) {
      const connectionPlan = this.buildConnectionPlan({ stage, text });

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

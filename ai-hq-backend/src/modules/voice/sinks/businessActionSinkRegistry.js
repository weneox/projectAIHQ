import {
  VOICE_BUSINESS_ACTION_SINK_STATUS,
  buildBusinessActionSinkContracts,
  normalizeBusinessActionSinkName,
} from "./businessActionSinkContracts.js";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export const VOICE_BUSINESS_ACTION_SINK_REGISTRY_VERSION =
  "voice_business_action_sink_registry.v1";

function buildVoiceCoreSinkResult({ sinkContract = {}, requestRecord = {} } = {}) {
  return {
    ok: true,
    sink: "voice_core",
    status: VOICE_BUSINESS_ACTION_SINK_STATUS.RECORDED,
    requestId: s(sinkContract.requestId || requestRecord.id),
    reasonCode: "",
    message: "Voice core event already recorded the business action request.",
  };
}

function defaultSinkExecutors() {
  return {
    voice_core: buildVoiceCoreSinkResult,
  };
}

export function createBusinessActionSinkRegistry(customExecutors = {}) {
  return {
    version: VOICE_BUSINESS_ACTION_SINK_REGISTRY_VERSION,
    executors: {
      ...defaultSinkExecutors(),
      ...obj(customExecutors),
    },
  };
}

export function resolveBusinessActionSinkExecutor({
  registry = createBusinessActionSinkRegistry(),
  sink = "",
} = {}) {
  const executors = obj(registry.executors || registry);
  const name = normalizeBusinessActionSinkName(sink);

  return executors[name] || null;
}

export async function dispatchBusinessActionSink({
  sinkContract = {},
  requestRecord = {},
  result = {},
  runtimeConfig = {},
  registry = createBusinessActionSinkRegistry(),
} = {}) {
  const contract = obj(sinkContract);
  const sink = normalizeBusinessActionSinkName(contract.sink);

  if (contract.enabled !== true) {
    return {
      ok: true,
      sink,
      status: VOICE_BUSINESS_ACTION_SINK_STATUS.SKIPPED,
      requestId: s(contract.requestId || requestRecord.id),
      reasonCode: s(contract.reasonCode || "voice_business_action_sink_disabled"),
      message: "Business action sink is disabled.",
    };
  }

  if (contract.ready !== true) {
    return {
      ok: false,
      sink,
      status: VOICE_BUSINESS_ACTION_SINK_STATUS.NOT_CONFIGURED,
      requestId: s(contract.requestId || requestRecord.id),
      reasonCode: s(contract.reasonCode || "voice_business_action_sink_not_ready"),
      message: "Business action sink is not ready.",
    };
  }

  const executor = resolveBusinessActionSinkExecutor({ registry, sink });
  if (typeof executor !== "function") {
    return {
      ok: false,
      sink,
      status: VOICE_BUSINESS_ACTION_SINK_STATUS.NOT_CONFIGURED,
      requestId: s(contract.requestId || requestRecord.id),
      reasonCode: "voice_business_action_sink_executor_not_configured",
      message: "Business action sink executor is not configured.",
    };
  }

  try {
    return await executor({
      sinkContract: contract,
      requestRecord,
      result,
      runtimeConfig,
    });
  } catch (error) {
    return {
      ok: false,
      sink,
      status: VOICE_BUSINESS_ACTION_SINK_STATUS.FAILED,
      requestId: s(contract.requestId || requestRecord.id),
      reasonCode: "voice_business_action_sink_failed",
      errorMessage: s(error?.message || error),
      message: "Business action sink failed.",
    };
  }
}

export async function dispatchBusinessActionSinks({
  requestRecord = {},
  result = {},
  runtimeConfig = {},
  sinks = null,
  registry = createBusinessActionSinkRegistry(),
} = {}) {
  const contracts = buildBusinessActionSinkContracts({
    runtimeConfig,
    requestRecord,
    sinks,
  });

  const deliveries = [];
  for (const sinkContract of contracts) {
    deliveries.push(
      await dispatchBusinessActionSink({
        sinkContract,
        requestRecord,
        result,
        runtimeConfig,
        registry,
      })
    );
  }

  return {
    ok: deliveries.every((item) => item.ok !== false),
    requestId: s(requestRecord.id || result.requestId),
    deliveries,
    sinkDelivery: deliveries.reduce((acc, item) => {
      acc[item.sink] = s(item.status);
      return acc;
    }, {}),
  };
}

export function buildBusinessActionSinkDeliverySnapshot({
  deliveries = [],
  fallback = {},
} = {}) {
  const base = {
    voiceCore: s(fallback.voiceCore || fallback.voice_core || "recorded"),
    inbox: s(fallback.inbox || "not_attempted"),
    calendar: s(fallback.calendar || "not_attempted"),
    crm: s(fallback.crm || "not_attempted"),
    webhook: s(fallback.webhook || "not_attempted"),
  };

  for (const item of Array.isArray(deliveries) ? deliveries : []) {
    const sink = normalizeBusinessActionSinkName(item.sink);
    const status = s(item.status || "not_attempted");

    if (sink === "voice_core") base.voiceCore = status;
    if (sink === "inbox") base.inbox = status;
    if (sink === "calendar") base.calendar = status;
    if (sink === "crm") base.crm = status;
    if (sink === "webhook") base.webhook = status;
  }

  return base;
}

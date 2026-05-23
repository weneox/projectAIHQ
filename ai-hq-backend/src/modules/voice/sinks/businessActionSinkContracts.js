function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export const VOICE_BUSINESS_ACTION_SINK_CONTRACT_VERSION =
  "voice_business_action_sink_contract.v1";

export const VOICE_BUSINESS_ACTION_SINKS = Object.freeze([
  "voice_core",
  "inbox",
  "calendar",
  "crm",
  "webhook",
  "none",
]);

export const VOICE_BUSINESS_ACTION_SINK_STATUS = Object.freeze({
  RECORDED: "recorded",
  SKIPPED: "skipped",
  NOT_CONFIGURED: "not_configured",
  DELIVERED: "delivered",
  FAILED: "failed",
});

export function normalizeBusinessActionSinkName(value = "", fallback = "none") {
  const raw = s(value || fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["core", "voice", "voice_event", "voice_core"].includes(raw)) {
    return "voice_core";
  }

  if (["operator_inbox", "ops_inbox", "inbox"].includes(raw)) {
    return "inbox";
  }

  if (["google_calendar", "outlook_calendar", "calendar"].includes(raw)) {
    return "calendar";
  }

  if (["hubspot", "salesforce", "crm"].includes(raw)) {
    return "crm";
  }

  if (["http", "api", "external_api", "webhook"].includes(raw)) {
    return "webhook";
  }

  if (["off", "disabled", "none"].includes(raw)) {
    return "none";
  }

  return VOICE_BUSINESS_ACTION_SINKS.includes(raw) ? raw : "none";
}

function readSinkConfig(runtimeConfig = {}, sink = "") {
  const runtime = obj(runtimeConfig);
  const sinks = obj(runtime.sinks || runtime.voiceSinks || runtime.businessActionSinks);
  return obj(sinks[sink] || sinks[normalizeBusinessActionSinkName(sink)]);
}

export function buildBusinessActionSinkContract({
  sink = "",
  runtimeConfig = {},
  requestRecord = {},
  enabled = null,
} = {}) {
  const name = normalizeBusinessActionSinkName(sink);
  const config = readSinkConfig(runtimeConfig, name);
  const explicitEnabled = typeof enabled === "boolean" ? enabled : null;
  const configEnabled = typeof config.enabled === "boolean" ? config.enabled : null;
  const isVoiceCore = name === "voice_core";
  const isEnabled =
    explicitEnabled !== null ? explicitEnabled : configEnabled !== null ? configEnabled : isVoiceCore;

  const record = obj(requestRecord);
  const requestId = s(record.id || record.requestId);

  return {
    version: VOICE_BUSINESS_ACTION_SINK_CONTRACT_VERSION,
    sink: name,
    enabled: isEnabled,
    requestId,
    tenantId: s(record.tenantId),
    tenantKey: s(record.tenantKey),
    callId: s(record.callId),
    requestType: s(record.requestType),
    businessFamily: s(record.businessFamily),
    provider: s(config.provider || name),
    adapterRequired: name !== "voice_core" && name !== "none",
    ready:
      name === "voice_core"
        ? true
        : name !== "none" && isEnabled === true && !!requestId,
    reasonCode:
      name === "none"
        ? "voice_business_action_sink_none"
        : !isEnabled
          ? "voice_business_action_sink_disabled"
          : !requestId
            ? "voice_business_action_sink_missing_request_id"
            : "",
  };
}

export function resolveBusinessActionSinkNames({
  runtimeConfig = {},
  sinks = null,
} = {}) {
  const runtime = obj(runtimeConfig);
  const explicit = arr(sinks);

  const configured = explicit.length
    ? explicit
    : [
        ...arr(runtime.businessActionSinkNames),
        ...arr(runtime.voiceSinkNames),
        ...arr(runtime.enabledSinks),
        ...arr(runtime.sinks),
      ];

  const nested = obj(runtime.businessActionSinks || runtime.voiceSinks);
  const names = ["voice_core", ...configured];

  for (const sink of ["inbox", "calendar", "crm", "webhook"]) {
    if (obj(nested[sink]).enabled === true) {
      names.push(sink);
    }
  }

  return Array.from(
    new Set(
      names
        .map((item) => normalizeBusinessActionSinkName(item))
        .filter((item) => item && item !== "none")
    )
  );
}

export function buildBusinessActionSinkContracts({
  runtimeConfig = {},
  requestRecord = {},
  sinks = ["voice_core"],
} = {}) {
  const list = Array.isArray(sinks) && sinks.length ? sinks : ["voice_core"];

  return list
    .map((sink) =>
      buildBusinessActionSinkContract({
        sink,
        runtimeConfig,
        requestRecord,
      })
    )
    .filter((item) => item.sink !== "none");
}

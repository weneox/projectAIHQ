import {
  normalizeProviderRealtimeCallId,
} from "./realtimeControlPlane.js";

export const VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION =
  "voice-realtime-sideband-connector-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function clean(value = "", max = 240) {
  return s(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function truthy(value = "") {
  return ["1", "true", "yes", "y", "on"].includes(lower(value));
}

export function isRealtimeSidebandEnabled(env = process.env) {
  return truthy(
    env.VOICE_REALTIME_SIDEBAND_ENABLED ||
      env.AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED
  );
}

function buildSidebandUrl(baseUrl = "", providerRealtimeCallId = "") {
  const url = new URL(baseUrl || "wss://api.openai.com/v1/realtime");
  url.searchParams.set("call_id", providerRealtimeCallId);
  return url.toString();
}

export function buildRealtimeSidebandConnectionPlan({
  target = {},
  env = process.env,
} = {}) {
  const provider = lower(target.provider || "openai");
  const transport = lower(target.transport || "webrtc");
  const providerRealtimeCallId = normalizeProviderRealtimeCallId(
    target.providerRealtimeCallId
  );

  const base = {
    version: VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION,
    provider,
    transport,
    providerRealtimeCallId,
    enabled: false,
    status: "disabled",
    reasonCode: "sideband_disabled",
    url: "",
    networkIo: false,
    authorizationConfigured: false,
  };

  if (!isRealtimeSidebandEnabled(env)) {
    return base;
  }

  if (provider !== "openai") {
    return {
      ...base,
      status: "blocked",
      reasonCode: "unsupported_realtime_provider",
    };
  }

  if (!providerRealtimeCallId) {
    return {
      ...base,
      status: "blocked",
      reasonCode: "provider_realtime_call_id_missing",
    };
  }

  const authorizationConfigured = !!s(env.OPENAI_API_KEY);
  if (!authorizationConfigured) {
    return {
      ...base,
      status: "blocked",
      reasonCode: "openai_api_key_missing",
      authorizationConfigured: false,
    };
  }

  let url = "";
  try {
    url = buildSidebandUrl(
      env.OPENAI_REALTIME_SIDEBAND_URL || "wss://api.openai.com/v1/realtime",
      providerRealtimeCallId
    );
  } catch {
    return {
      ...base,
      status: "blocked",
      reasonCode: "invalid_sideband_url",
      authorizationConfigured,
    };
  }

  return {
    ...base,
    enabled: true,
    status: "ready",
    reasonCode: "",
    url,
    authorizationConfigured,
    headers: {
      Authorization: "Bearer <configured>",
      "OpenAI-Beta": "realtime=v1",
    },
  };
}

export function buildRealtimeSidebandTrace(plan = {}) {
  return {
    version: clean(plan.version || VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION),
    enabled: plan.enabled === true,
    status: clean(plan.status || "disabled", 80),
    reasonCode: clean(plan.reasonCode, 120),
    provider: clean(plan.provider || "openai", 80),
    transport: clean(plan.transport || "webrtc", 80),
    providerRealtimeCallId: normalizeProviderRealtimeCallId(
      plan.providerRealtimeCallId
    ),
    url: plan.enabled === true ? clean(plan.url, 300) : "",
    networkIo: false,
    authorizationConfigured: plan.authorizationConfigured === true,
  };
}

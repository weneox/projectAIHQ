import {
  buildRealtimeProviderSidebandPlan,
  buildRealtimeProviderSidebandTrace,
} from "./realtimeProviderAdapters.js";

export const VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION =
  "voice-realtime-sideband-connector-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function lower(value = "") {
  return s(value).toLowerCase();
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

export function buildRealtimeSidebandConnectionPlan({
  target = {},
  provider = "",
  env = process.env,
} = {}) {
  const planned = buildRealtimeProviderSidebandPlan({
    provider: provider || target.provider,
    target,
    env,
  });

  return planned?.sidebandPlan || {
    version: VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION,
    provider: s(provider || target.provider || "openai"),
    transport: s(target.transport || "webrtc"),
    providerRealtimeCallId: s(target.providerRealtimeCallId),
    enabled: false,
    status: planned?.status || "blocked",
    reasonCode: planned?.reasonCode || "sideband_plan_unavailable",
    url: "",
    networkIo: false,
    authorizationConfigured: false,
  };
}

export function buildRealtimeSidebandTrace(plan = {}) {
  const traced = buildRealtimeProviderSidebandTrace({
    provider: plan.provider,
    plan,
    target: plan.target || {},
  });

  return traced?.sidebandTrace || {
    version: VOICE_REALTIME_SIDEBAND_CONNECTOR_VERSION,
    enabled: false,
    status: s(plan.status || "blocked"),
    reasonCode: s(plan.reasonCode || "sideband_trace_unavailable"),
    provider: s(plan.provider || "openai"),
    transport: s(plan.transport || "webrtc"),
    providerRealtimeCallId: s(plan.providerRealtimeCallId),
    url: "",
    networkIo: false,
    authorizationConfigured: false,
  };
}
